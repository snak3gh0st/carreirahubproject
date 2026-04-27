/**
 * Retroactive sync: check all SENT_FOR_SIGNATURE contracts against DocuSign API
 * and update their status in the database.
 *
 * This backfills status changes that were missed due to DocuSign Connect
 * not being configured (no webhooks received).
 *
 * Usage:
 *   npx tsx scripts/sync-docusign-status.ts          # dry-run (default)
 *   npx tsx scripts/sync-docusign-status.ts --apply   # actually update DB
 */
import * as crypto from 'crypto';
import { PrismaClient, ContractStatus } from '@prisma/client';

const prisma = new PrismaClient();

const INTEGRATION_KEY = process.env.DOCUSIGN_INTEGRATION_KEY || '';
const USER_ID = process.env.DOCUSIGN_USER_ID || '';
const ACCOUNT_ID = process.env.DOCUSIGN_ACCOUNT_ID || '';
const BASE_URL = process.env.DOCUSIGN_BASE_URL || 'https://na4.docusign.net';
const PRIVATE_KEY = (process.env.DOCUSIGN_PRIVATE_KEY || '').replace(/\\n/g, '\n');

const DRY_RUN = !process.argv.includes('--apply');

const DOCUSIGN_TO_HUB_STATUS: Record<string, ContractStatus> = {
  sent: 'SENT_FOR_SIGNATURE',
  delivered: 'VIEWED',
  completed: 'SIGNED',
  declined: 'DECLINED',
  voided: 'VOIDED',
};

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

async function getEnvelopeStatus(token: string, envelopeId: string) {
  const url = `${BASE_URL}/restapi/v2.1/accounts/${ACCOUNT_ID}/envelopes/${envelopeId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Envelope ${envelopeId}: ${res.status} ${err}`);
  }
  return res.json();
}

async function main() {
  console.log(`=== DocuSign Status Sync ${DRY_RUN ? '(DRY RUN)' : '(APPLYING CHANGES)'} ===\n`);

  const token = await getAccessToken();
  console.log('Authenticated with DocuSign.\n');

  // Find all contracts with a DocuSign envelope that aren't in a final state
  const contracts = await prisma.contract.findMany({
    where: {
      docusign_env_id: { not: null },
      status: { in: ['SENT_FOR_SIGNATURE', 'VIEWED', 'DRAFT'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${contracts.length} contracts to check.\n`);

  let updated = 0;
  let errors = 0;
  let unchanged = 0;

  for (const contract of contracts) {
    const envId = contract.docusign_env_id!;
    try {
      const envelope = await getEnvelopeStatus(token, envId);
      const dsStatus = envelope.status as string;
      const hubStatus = DOCUSIGN_TO_HUB_STATUS[dsStatus];

      if (!hubStatus) {
        console.log(`  ${contract.signerName} — DocuSign: "${dsStatus}" (unknown mapping), skipping`);
        continue;
      }

      if (contract.status === hubStatus) {
        console.log(`  ${contract.signerName} — already ${hubStatus}, no change`);
        unchanged++;
        continue;
      }

      console.log(`  ${contract.signerName} <${contract.signerEmail}>`);
      console.log(`    DB status: ${contract.status} → DocuSign status: ${dsStatus} → Hub: ${hubStatus}`);

      if (!DRY_RUN) {
        const updateData: any = { status: hubStatus };

        if (hubStatus === 'SIGNED' && envelope.completedDateTime) {
          updateData.signedAt = new Date(envelope.completedDateTime);
        }
        if (hubStatus === 'VOIDED' && envelope.voidedDateTime) {
          updateData.voidedAt = new Date(envelope.voidedDateTime);
        }

        await prisma.contract.update({
          where: { id: contract.id },
          data: updateData,
        });

        await prisma.integrationLog.create({
          data: {
            service: 'DOCUSIGN',
            action: 'RETROACTIVE_SYNC',
            status: 'SUCCESS',
            payload: {
              contractId: contract.id,
              envelopeId: envId,
              oldStatus: contract.status,
              newStatus: hubStatus,
              docusignStatus: dsStatus,
            },
          },
        });

        console.log(`    ✓ Updated to ${hubStatus}`);
      } else {
        console.log(`    → Would update to ${hubStatus}`);
      }
      updated++;

      // Rate limit: DocuSign allows ~1000 calls/hour
      await new Promise((r) => setTimeout(r, 200));
    } catch (e: any) {
      console.error(`  ${contract.signerName} — ERROR: ${e.message}`);
      errors++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Checked: ${contracts.length}`);
  console.log(`  ${DRY_RUN ? 'Would update' : 'Updated'}: ${updated}`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`  Errors: ${errors}`);

  if (DRY_RUN && updated > 0) {
    console.log(`\nRun with --apply to actually update the database:`);
    console.log(`  npx tsx scripts/sync-docusign-status.ts --apply`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
