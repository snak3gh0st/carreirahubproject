/**
 * Inspect DocuSign template tab structure for a given templateId.
 * Connects to the real DocuSign API using the same JWT auth as the service.
 *
 * Usage:
 *   npx tsx scripts/inspect-docusign-template.ts [templateId]
 *
 * Default: Anexo B (Pass) — 189a5097-ae86-4f65-b0ac-b7bea1b150bf
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as crypto from 'crypto';

const INTEGRATION_KEY = process.env.DOCUSIGN_INTEGRATION_KEY || '';
const USER_ID         = process.env.DOCUSIGN_USER_ID || '';
const ACCOUNT_ID      = process.env.DOCUSIGN_ACCOUNT_ID || '';
const BASE_URL        = process.env.DOCUSIGN_BASE_URL || 'https://na4.docusign.net';
const PRIVATE_KEY_RAW = process.env.DOCUSIGN_PRIVATE_KEY || '';

const TEMPLATE_ID = process.argv[2] || '189a5097-ae86-4f65-b0ac-b7bea1b150bf';

const OAUTH_HOST = BASE_URL.includes('demo')
  ? 'account-d.docusign.com'
  : 'account.docusign.com';

function getPrivateKey(): string {
  return PRIVATE_KEY_RAW.replace(/\\n/g, '\n');
}

async function getJwtToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'RS256' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: INTEGRATION_KEY,
    sub: USER_ID,
    aud: OAUTH_HOST,
    iat: now,
    exp: now + 3600,
    scope: 'signature impersonation',
  })).toString('base64url');

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(getPrivateKey(), 'base64url');
  const assertion = `${header}.${payload}.${sig}`;

  const resp = await fetch(`https://${OAUTH_HOST}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`JWT auth failed: ${resp.status} — ${text}`);
  }

  const data = await resp.json();
  return data.access_token;
}

async function dsGet(path: string, token: string) {
  const url = `${BASE_URL}/restapi/v2.1/accounts/${ACCOUNT_ID}${path}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GET ${path} → ${resp.status}: ${text.slice(0, 300)}`);
  }
  return resp.json();
}

async function main() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`DocuSign Template Inspector — ${TEMPLATE_ID}`);
  console.log('='.repeat(70));

  const token = await getJwtToken();
  console.log('✓ Authenticated\n');

  // 1. Template info
  const tmpl = await dsGet(`/templates/${TEMPLATE_ID}`, token);
  console.log(`Template name : ${tmpl.name}`);
  console.log(`Created       : ${tmpl.created}`);
  console.log(`Last modified : ${tmpl.lastModified}`);

  // 2. Recipients
  const recData = await dsGet(`/templates/${TEMPLATE_ID}/recipients`, token);
  const signers: any[] = recData.signers || [];
  console.log(`\nRecipients (${signers.length}):`);
  for (const s of signers) {
    console.log(`  [${s.recipientId}] "${s.roleName}" — name="${s.name}" email="${s.email}" routing=${s.routingOrder}`);
  }

  // 3. Tabs for each recipient
  for (const signer of signers) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Tabs for recipient [${signer.recipientId}] "${signer.roleName || signer.name}":`);

    let tabs: any;
    try {
      tabs = await dsGet(`/templates/${TEMPLATE_ID}/recipients/${signer.recipientId}/tabs`, token);
    } catch (e: any) {
      console.log(`  (no tabs or error: ${e.message})`);
      continue;
    }

    const textTabs: any[] = tabs.textTabs || [];
    const otherTypes = Object.entries(tabs)
      .filter(([k, v]) => k !== 'textTabs' && Array.isArray(v) && (v as any[]).length > 0)
      .map(([k, v]) => `${k}(${(v as any[]).length})`);

    if (textTabs.length === 0) {
      console.log(`  No textTabs. Other: ${otherTypes.join(', ') || 'none'}`);
      continue;
    }

    console.log(`  textTabs (${textTabs.length}) — other: ${otherTypes.join(', ') || 'none'}`);
    console.log(`  ${'tabLabel'.padEnd(30)} ${'shared'.padEnd(8)} ${'locked'.padEnd(8)} ${'w'.padEnd(6)} ${'h'.padEnd(6)} ${'x'.padEnd(6)} ${'y'.padEnd(6)} ${'fillColor'.padEnd(12)} ${'borderStyle'.padEnd(14)} value`);
    console.log(`  ${'─'.repeat(120)}`);

    for (const t of textTabs) {
      const label  = (t.tabLabel || '').padEnd(30);
      const shared = (t.shared  || '').padEnd(8);
      const locked = (t.locked  || '').padEnd(8);
      const w      = (t.width   || '').toString().padEnd(6);
      const h      = (t.height  || '').toString().padEnd(6);
      const x      = (t.xPosition || '').toString().padEnd(6);
      const y      = (t.yPosition || '').toString().padEnd(6);
      const fill   = (t.fillColor   || t.tabBackgroundColor || '(none)').padEnd(12);
      const border = (t.borderStyle || '(none)').padEnd(14);
      const val    = (t.value || '').slice(0, 30);
      console.log(`  ${label} ${shared} ${locked} ${w} ${h} ${x} ${y} ${fill} ${border} "${val}"`);

      // Show ALL raw properties for address tabs to find the blue color source
      if (t.tabLabel?.startsWith('client_address')) {
        const skip = new Set(['tabLabel','shared','locked','width','height','xPosition','yPosition','fillColor','tabBackgroundColor','borderStyle','value']);
        const extra = Object.entries(t)
          .filter(([k]) => !skip.has(k))
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join('  ');
        if (extra) console.log(`    └─ extra: ${extra}`);
      }
    }
  }

  console.log(`\n${'='.repeat(70)}\n`);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
