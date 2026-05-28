import { docusignService } from "@/lib/services/docusign.service";

async function main() {
  const templateId = process.env.DOCUSIGN_TEMPLATE_PASS;
  if (!templateId) {
    console.error("DOCUSIGN_TEMPLATE_PASS not set");
    process.exit(1);
  }
  console.log("Inspecting template:", templateId);

  // Use private access — fetch via raw API
  const accessToken = await (docusignService as any).getAccessToken();
  const baseUrl = (docusignService as any).baseUrl;
  const accountId = (docusignService as any).accountId;

  // Get template metadata
  const tplRes = await fetch(`${baseUrl}/restapi/v2.1/accounts/${accountId}/templates/${templateId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const tpl = await tplRes.json();
  console.log("\n=== TEMPLATE INFO ===");
  console.log("Name:", tpl.name);
  console.log("Description:", tpl.description);
  console.log("EmailSubject:", tpl.emailSubject);
  console.log("Documents:", tpl.documents?.map((d: any) => ({ id: d.documentId, name: d.name })));

  // Get template recipients (roles + tabs)
  const recRes = await fetch(`${baseUrl}/restapi/v2.1/accounts/${accountId}/templates/${templateId}/recipients?include_tabs=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const recs = await recRes.json();
  console.log("\n=== RECIPIENTS / ROLES ===");
  for (const signer of recs.signers || []) {
    console.log(`Role: "${signer.roleName}" | Order: ${signer.routingOrder} | Email: ${signer.email || "(placeholder)"}`);
    const tabs = signer.tabs || {};
    const counts: any = {};
    for (const k of Object.keys(tabs)) {
      if (Array.isArray(tabs[k])) counts[k] = tabs[k].length;
    }
    console.log("  Tab counts:", counts);

    // Print every tab type with name + label
    for (const tabType of Object.keys(tabs)) {
      const arr = tabs[tabType];
      if (!Array.isArray(arr) || arr.length === 0) continue;
      console.log(`\n  ${tabType}:`);
      for (const t of arr) {
        const label = t.tabLabel || t.name || "(no-label)";
        const value = t.value || t.selected || "";
        const required = t.required || "";
        const anchor = t.anchorString || "";
        console.log(`    - ${label}${anchor ? ` [anchor: ${anchor}]` : ""}${value ? ` = "${value}"` : ""}${required === "true" ? " *required" : ""}`);
      }
    }
  }
  for (const cc of recs.carbonCopies || []) {
    console.log(`CC role: "${cc.roleName}"`);
  }
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
