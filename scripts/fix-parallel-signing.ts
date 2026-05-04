/**
 * Fix envelope routing so all signers receive simultaneously (routingOrder=1).
 * Usage: npx tsx scripts/fix-parallel-signing.ts <envelopeId>
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const envelopeId = process.argv[2];
  if (!envelopeId) throw new Error("Pass envelopeId as arg");

  const { docusignService } = require("../lib/services/docusign.service");
  const svc: any = docusignService;
  const token = await svc.getAccessToken();
  const base = `${svc.baseUrl}/restapi/v2.1/accounts/${svc.accountId}/envelopes/${envelopeId}`;

  // 1. Fetch current recipients
  const res = await fetch(`${base}/recipients`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET recipients failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const signers: any[] = data.signers || [];

  console.log("Current signers:");
  signers.forEach((s) =>
    console.log(`  [${s.recipientId}] routingOrder=${s.routingOrder} ${s.name} <${s.email}> status=${s.status}`)
  );

  // 2. Build update payload — set all to routingOrder=1 (parallel)
  const updatedSigners = signers.map((s: any) => ({
    recipientId: s.recipientId,
    routingOrder: "1",
    email: s.email,
    name: s.name,
  }));

  // 3. PUT recipients with resend_envelope=true
  const putRes = await fetch(`${base}/recipients?resend_envelope=true`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ signers: updatedSigners }),
  });

  const putBody = await putRes.text();
  if (!putRes.ok) throw new Error(`PUT recipients failed: ${putRes.status} ${putBody}`);

  console.log("\nRouting updated to parallel (routingOrder=1 for all) — all signers will be notified.");
  console.log("Response:", putBody.slice(0, 500));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
