import * as crypto from 'crypto';

const INTEGRATION_KEY = process.env.DOCUSIGN_INTEGRATION_KEY || '';
const USER_ID = process.env.DOCUSIGN_USER_ID || '';
const ACCOUNT_ID = process.env.DOCUSIGN_ACCOUNT_ID || '';
const BASE_URL = process.env.DOCUSIGN_BASE_URL || 'https://na4.docusign.net';
const PRIVATE_KEY = (process.env.DOCUSIGN_PRIVATE_KEY || '').replace(/\\n/g, '\n');

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const oauthBasePath = BASE_URL.includes('demo')
    ? 'https://account-d.docusign.com'
    : 'https://account.docusign.com';

  const header = { typ: 'JWT', alg: 'RS256' };
  const payload = {
    iss: INTEGRATION_KEY,
    sub: USER_ID,
    aud: oauthBasePath.replace('https://', ''),
    iat: now,
    exp: now + 3600,
    scope: 'signature impersonation',
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signatureInput = `${headerB64}.${payloadB64}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(PRIVATE_KEY, 'base64url');
  const jwtToken = `${signatureInput}.${signature}`;

  const res = await fetch(`${oauthBasePath}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwtToken}`,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`JWT auth failed: ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function apiGet(token: string, endpoint: string) {
  const url = `${BASE_URL}/restapi/v2.1/accounts/${ACCOUNT_ID}${endpoint}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${endpoint}: ${res.status} ${err}`);
  }
  return res.json();
}

async function main() {
  console.log('=== DocuSign Diagnostic ===\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Account ID: ${ACCOUNT_ID ? ACCOUNT_ID.slice(0, 8) + '...' : 'MISSING'}`);
  console.log(`Integration Key: ${INTEGRATION_KEY ? INTEGRATION_KEY.slice(0, 8) + '...' : 'MISSING'}`);
  console.log(`User ID: ${USER_ID ? USER_ID.slice(0, 8) + '...' : 'MISSING'}`);
  console.log(`Private Key: ${PRIVATE_KEY ? 'SET (' + PRIVATE_KEY.length + ' chars)' : 'MISSING'}`);
  console.log();

  // 1. Test authentication
  console.log('--- 1. JWT Authentication ---');
  let token: string;
  try {
    token = await getAccessToken();
    console.log('✓ Authentication successful\n');
  } catch (e: any) {
    console.error('✗ Authentication FAILED:', e.message);
    return;
  }

  // 2. Check recent envelopes directly from DocuSign
  console.log('--- 2. Recent Envelopes (from DocuSign API) ---');
  const envelopeIds = [
    '92e3e86d-dc7b-809d-8204-fa912668e762', // Thais 21/04
    '3dde56df-95e7-87ea-8051-23b2d001ee20', // Philipe 21/04
    'aca40f86-ff7e-8731-80e4-7d6fe241c81f', // Maria Beatriz 21/04
    '97556628-3934-8f22-8988-e5f3d57d59a4', // Tiago 17/04 (partial from DB)
    '5ab07ab2-39d4-4201-a3bf-0000000000000', // Lívia 16/04 (partial)
  ];

  for (const envId of envelopeIds.slice(0, 3)) {
    try {
      const env = await apiGet(token, `/envelopes/${envId}`);
      console.log(`  ${envId.slice(0, 12)}... → DocuSign status: ${env.status}`);
      console.log(`    statusChangedDateTime: ${env.statusChangedDateTime}`);
      console.log(`    sentDateTime: ${env.sentDateTime}`);
      if (env.deliveredDateTime) console.log(`    deliveredDateTime: ${env.deliveredDateTime}`);
      if (env.completedDateTime) console.log(`    completedDateTime: ${env.completedDateTime}`);
      if (env.declinedDateTime) console.log(`    declinedDateTime: ${env.declinedDateTime}`);
      if (env.voidedDateTime) console.log(`    voidedDateTime: ${env.voidedDateTime}`);
      console.log();
    } catch (e: any) {
      console.error(`  ${envId.slice(0, 12)}... → ERROR: ${e.message}\n`);
    }
  }

  // 3. Check recent envelopes with status filter
  console.log('--- 3. All Envelopes Last 30 Days (status summary) ---');
  try {
    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const data = await apiGet(token, `/envelopes?from_date=${fromDate}&count=100`);
    const envelopes = data.envelopes || [];
    const statusCounts: Record<string, number> = {};
    for (const e of envelopes) {
      statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
    }
    console.log(`  Total envelopes: ${envelopes.length}`);
    for (const [status, count] of Object.entries(statusCounts)) {
      console.log(`    ${status}: ${count}`);
    }
    console.log();

    // Show most recent 5
    console.log('  Most recent envelopes:');
    for (const e of envelopes.slice(0, 8)) {
      console.log(`    ${e.envelopeId?.slice(0, 12)}... | ${e.status.padEnd(12)} | ${e.statusChangedDateTime} | ${e.emailSubject?.slice(0, 50)}`);
    }
    console.log();
  } catch (e: any) {
    console.error('  ERROR:', e.message, '\n');
  }

  // 4. Check DocuSign Connect (webhook) configuration
  console.log('--- 4. DocuSign Connect Configuration ---');
  try {
    const connectData = await apiGet(token, `/connect`);
    const configs = connectData.configurations || [];
    if (configs.length === 0) {
      console.log('  ✗ NO Connect configurations found!');
      console.log('  → This explains why no webhooks are received.');
      console.log('  → DocuSign Connect must be configured to send events to:');
      console.log('    https://carreirausa.sigmaintel.io/api/webhooks/docusign');
    } else {
      for (const config of configs) {
        console.log(`  Config: ${config.name || 'unnamed'}`);
        console.log(`    URL: ${config.urlToPublishTo}`);
        console.log(`    Active: ${config.allowEnvelopePublish}`);
        console.log(`    Events: ${(config.envelopeEvents || []).join(', ')}`);
        console.log(`    HMAC: ${config.useSoapInterface ? 'SOAP' : 'REST'}`);
        console.log();
      }
    }
  } catch (e: any) {
    console.error('  ERROR fetching Connect config:', e.message);
    console.log('  (This may require admin access)');
  }
  console.log();

  // 5. Check envelope recipients for a recent one
  console.log('--- 5. Recipient Details (most recent envelope) ---');
  try {
    const recipients = await apiGet(token, `/envelopes/${envelopeIds[0]}/recipients`);
    const signers = recipients.signers || [];
    for (const s of signers) {
      console.log(`  ${s.roleName || 'no-role'} (${s.name} <${s.email}>)`);
      console.log(`    recipientId: ${s.recipientId}, routingOrder: ${s.routingOrder}`);
      console.log(`    status: ${s.status}, deliveredDateTime: ${s.deliveredDateTime || 'N/A'}`);
      console.log(`    signedDateTime: ${s.signedDateTime || 'N/A'}`);
      console.log();
    }
  } catch (e: any) {
    console.error('  ERROR:', e.message);
  }

  console.log('=== Diagnostic Complete ===');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
