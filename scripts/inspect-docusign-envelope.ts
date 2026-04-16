/**
 * Inspect recipient tabs of a given envelope — shows tabLabel, value, locked.
 * Usage: npx tsx scripts/inspect-docusign-envelope.ts <envelopeId>
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const envelopeId = process.argv[2];
  if (!envelopeId) throw new Error("Pass envelopeId as arg");

  const { docusignService } = require("../lib/services/docusign.service");
  // Re-use the private apiRequest via reflection
  const svc: any = docusignService;
  // Ensure auth
  await svc.getAccessToken();

  const url = `${svc.baseUrl}/restapi/v2.1/accounts/${svc.accountId}/envelopes/${envelopeId}/recipients?include_tabs=true`;
  const token = await svc.getAccessToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Failed: ${res.status} ${await res.text()}`);
  const data = await res.json();

  for (const signer of data.signers || []) {
    console.log(`\n[SIGNER] ${signer.name} <${signer.email}> (roleName=${signer.roleName})`);
    const textTabs = signer.tabs?.textTabs || [];
    for (const t of textTabs) {
      console.log(
        `  [TEXT]  tabLabel="${t.tabLabel}" value="${t.value || ""}" doc=${t.documentId} pg=${t.pageNumber} x=${t.xPosition} y=${t.yPosition} w=${t.width} h=${t.height}`
      );
    }
    const signTabs = signer.tabs?.signHereTabs || [];
    for (const t of signTabs) {
      console.log(
        `  [SIGN]  doc=${t.documentId} pg=${t.pageNumber} x=${t.xPosition} y=${t.yPosition} w=${t.width} h=${t.height} optional=${t.optional}`
      );
    }
    const dateTabs = signer.tabs?.dateSignedTabs || [];
    for (const t of dateTabs) {
      console.log(
        `  [DATE_SIGNED] doc=${t.documentId} pg=${t.pageNumber} x=${t.xPosition} y=${t.yPosition}`
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
