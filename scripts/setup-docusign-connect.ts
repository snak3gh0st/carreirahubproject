/**
 * Setup DocuSign Connect (Webhook) configuration via API.
 *
 * Creates a Connect configuration that sends envelope events to:
 *   https://carreirausa.sigmaintel.io/api/webhooks/docusign
 *
 * Events: envelope-sent, envelope-delivered, envelope-completed,
 *         envelope-declined, envelope-voided
 *
 * Usage:
 *   npx tsx scripts/setup-docusign-connect.ts
 */
import * as crypto from 'crypto';

const INTEGRATION_KEY = process.env.DOCUSIGN_INTEGRATION_KEY || '';
const USER_ID = process.env.DOCUSIGN_USER_ID || '';
const ACCOUNT_ID = process.env.DOCUSIGN_ACCOUNT_ID || '';
const BASE_URL = process.env.DOCUSIGN_BASE_URL || 'https://na4.docusign.net';
const PRIVATE_KEY = (process.env.DOCUSIGN_PRIVATE_KEY || '').replace(/\\n/g, '\n');

const WEBHOOK_URL = 'https://carreirausa.sigmaintel.io/api/webhooks/docusign';

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

  if (!res.ok) throw new Error(`JWT auth failed: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function main() {
  console.log('=== DocuSign Connect Setup ===\n');

  // Generate HMAC secret for webhook verification
  const hmacSecret = crypto.randomBytes(32).toString('hex');
  console.log('Generated HMAC secret for webhook verification.');
  console.log('Add this to your Vercel environment variables:\n');
  console.log(`  DOCUSIGN_WEBHOOK_SECRET=${hmacSecret}\n`);

  const token = await getAccessToken();
  console.log('Authenticated with DocuSign.\n');

  // Check existing configurations
  const checkRes = await fetch(
    `${BASE_URL}/restapi/v2.1/accounts/${ACCOUNT_ID}/connect`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
  );

  if (checkRes.ok) {
    const existing = await checkRes.json();
    const configs = existing.configurations || [];
    if (configs.length > 0) {
      console.log(`Found ${configs.length} existing Connect configuration(s):`);
      for (const c of configs) {
        console.log(`  - ${c.name}: ${c.urlToPublishTo} (active: ${c.allowEnvelopePublish})`);
      }
      console.log('\nAborting to avoid duplicates. Delete existing configs first if needed.\n');
      return;
    }
  }

  // Create Connect configuration
  // Note: configurationType is required by the DocuSign API.
  // The eventData block (with version restv2.1) auto-subscribes to all
  // envelope and recipient events — no separate envelopeEvents array needed.
  const connectConfig = {
    configurationType: 'custom',
    name: 'CarreiraHub Webhook',
    urlToPublishTo: WEBHOOK_URL,
    allowEnvelopePublish: 'true',
    enableLog: 'true',
    allUsers: 'true',
    includeDocumentFields: 'true',
    requiresAcknowledgement: 'true',
    useSoapInterface: 'false',
    includeEnvelopeVoidReason: 'true',
    includeSenderAccountasCustomField: 'true',
    eventData: {
      version: 'restv2.1',
      format: 'json',
      includeData: ['recipients', 'tabs'],
    },
  };

  console.log('Creating Connect configuration...');
  console.log(`  URL: ${WEBHOOK_URL}`);
  console.log();

  const createRes = await fetch(
    `${BASE_URL}/restapi/v2.1/accounts/${ACCOUNT_ID}/connect`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(connectConfig),
    }
  );

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error(`Failed to create Connect configuration: ${createRes.status}`);
    console.error(err);
    return;
  }

  const result = await createRes.json();
  console.log('Connect configuration created successfully!');
  console.log(`  Config ID: ${result.connectId}`);
  console.log(`  Name: ${result.name}`);
  console.log(`  URL: ${result.urlToPublishTo}`);
  console.log();

  // Now set HMAC key on the configuration
  console.log('Setting HMAC key for webhook signature verification...');
  const hmacRes = await fetch(
    `${BASE_URL}/restapi/v2.1/accounts/${ACCOUNT_ID}/connect/config/${result.connectId}/hmac`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        hmacSecret1: hmacSecret,
      }),
    }
  );

  if (hmacRes.ok) {
    console.log('HMAC key set successfully.');
  } else {
    const hmacErr = await hmacRes.text();
    console.warn(`HMAC setup returned ${hmacRes.status}: ${hmacErr}`);
    console.log('Webhook will still work, but without signature verification.');
    console.log('You can set the HMAC key manually in DocuSign Admin > Connect > Chaves do Connect.');
  }

  console.log('\n=== NEXT STEPS ===');
  console.log('1. Add DOCUSIGN_WEBHOOK_SECRET to Vercel env vars');
  console.log('2. Redeploy to pick up the new env var');
  console.log('3. Run scripts/sync-docusign-status.ts to backfill missed events');
  console.log('4. Test by sending a new contract and signing it');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
