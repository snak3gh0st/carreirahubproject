/**
 * Check DocuSign audit logs for Connect configuration changes.
 * Tries to find who deleted the webhook configuration.
 */
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

  if (!res.ok) throw new Error(`JWT auth failed: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function main() {
  console.log('=== DocuSign Audit: Connect Configuration Changes ===\n');

  const token = await getAccessToken();

  // 1. Check Connect logs (failed delivery logs can show when it was last active)
  console.log('--- Connect Failure Logs (shows last active period) ---');
  try {
    const logsRes = await fetch(
      `${BASE_URL}/restapi/v2.1/accounts/${ACCOUNT_ID}/connect/logs?from_date=2026-01-01T00:00:00Z&to_date=2026-04-28T00:00:00Z`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
    );
    if (logsRes.ok) {
      const logsData = await logsRes.json();
      const logs = logsData.logs || [];
      console.log(`  Total Connect log entries: ${logs.length}`);
      for (const log of logs.slice(0, 10)) {
        console.log(`  ${log.lastDateTime} | ${log.status} | ${log.connectDebugLog?.slice(0, 80) || ''}`);
      }
      if (logs.length === 0) {
        console.log('  No Connect logs found — webhook may never have delivered successfully,');
        console.log('  or logs were purged when the config was deleted.');
      }
    } else {
      const err = await logsRes.text();
      console.log(`  API returned ${logsRes.status}: ${err.slice(0, 200)}`);
    }
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }

  // 2. Check account users (who has admin access to delete Connect configs)
  console.log('\n--- Account Users with Admin Access ---');
  try {
    const oauthBasePath = BASE_URL.includes('demo')
      ? 'https://account-d.docusign.com'
      : 'https://account.docusign.com';

    const usersRes = await fetch(
      `${BASE_URL}/restapi/v2.1/accounts/${ACCOUNT_ID}/users?additional_info=true`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
    );
    if (usersRes.ok) {
      const usersData = await usersRes.json();
      const users = usersData.users || [];
      console.log(`  Total users: ${users.length}\n`);
      for (const user of users) {
        const isAdmin = user.isAdmin === 'True' || user.isAdmin === true;
        const lastLogin = user.lastLogin || 'never';
        console.log(`  ${user.userName} <${user.email}>`);
        console.log(`    Admin: ${isAdmin ? 'YES' : 'no'} | Status: ${user.userStatus} | Last Login: ${lastLogin}`);
        console.log();
      }
    } else {
      console.log(`  API returned ${usersRes.status}`);
    }
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }

  // 3. Look at our integration logs for when webhooks STOPPED arriving
  console.log('--- Hub Integration Logs: Last Webhook Received ---');
  console.log('  (Check the database — webhook_events table is empty for docusign)');
  console.log('  This means either:');
  console.log('    a) Connect was never configured for this account');
  console.log('    b) Connect was configured but pointed to a different URL');
  console.log('    c) Connect was deleted and all logs were purged');

  // 4. Check if there were any Connect configs deleted recently
  console.log('\n--- Connect Config History (via API) ---');
  try {
    const histRes = await fetch(
      `${BASE_URL}/restapi/v2.1/accounts/${ACCOUNT_ID}/connect?count=100&status_filter=all`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
    );
    if (histRes.ok) {
      const histData = await histRes.json();
      console.log(`  Total configs (including inactive): ${histData.totalRecords || 0}`);
      const configs = histData.configurations || [];
      if (configs.length === 0) {
        console.log('  No configurations found (active or inactive).');
      }
      for (const c of configs) {
        console.log(`  ${c.name} — ${c.urlToPublishTo} — active: ${c.allowEnvelopePublish}`);
      }
    } else {
      console.log(`  API returned ${histRes.status}`);
    }
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }

  console.log('\n=== Analysis ===');
  console.log('DocuSign does not expose a detailed audit trail for Connect config deletions');
  console.log('via the eSignature API. To find who deleted it:');
  console.log('  1. Check DocuSign Admin UI > Organization > Audit Logs (if org-level admin)');
  console.log('  2. Review the list of admin users above — only admins can modify Connect');
  console.log('  3. The webhook_events table being empty suggests it may have never been');
  console.log('     configured to point to the Hub URL specifically');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
