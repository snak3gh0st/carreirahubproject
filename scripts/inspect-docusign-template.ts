import { docusignService } from "@/lib/services/docusign.service";

const TEMPLATES = [
  { envVar: "DOCUSIGN_TEMPLATE_PASS_ADVANCED", label: "PASS_ADVANCED (Anexo A)" },
  { envVar: "DOCUSIGN_TEMPLATE_PASS", label: "PASS (Anexo B)" },
  { envVar: "DOCUSIGN_TEMPLATE_COMBO", label: "COMBO (Anexo C)" },
  { envVar: "DOCUSIGN_TEMPLATE_START", label: "START (Anexo D)" },
  { envVar: "DOCUSIGN_TEMPLATE_AVULSO", label: "AVULSO (Anexo E atual)" },
  { envVar: "DOCUSIGN_TEMPLATE_UPGRADE", label: "UPGRADE (Anexo F)" },
  { envVar: "DOCUSIGN_TEMPLATE_NEW_PASS", label: "NEW_PASS (Anexo G)" },
  { envVar: "DOCUSIGN_TEMPLATE_TREINAMENTO", label: "TREINAMENTO (Anexo H)" },
  { envVar: "DOCUSIGN_TEMPLATE_EARLY_CAREER", label: "EARLY_CAREER" },
];

async function inspectTemplate(
  templateId: string,
  label: string,
  baseUrl: string,
  accountId: string,
  token: string,
  detail: boolean,
) {
  const [tplRes, recRes] = await Promise.all([
    fetch(`${baseUrl}/restapi/v2.1/accounts/${accountId}/templates/${templateId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(
      `${baseUrl}/restapi/v2.1/accounts/${accountId}/templates/${templateId}/recipients?include_tabs=true`,
      { headers: { Authorization: `Bearer ${token}` } },
    ),
  ]);
  if (!tplRes.ok) {
    console.log(`\n[${label}] templateId=${templateId} → ERROR ${tplRes.status}`);
    return;
  }
  const tpl = await tplRes.json();
  const recs = await recRes.json();

  console.log(`\n=== ${label} ===`);
  console.log(`templateId: ${templateId}`);
  console.log(`name:       ${tpl.name}`);
  console.log(`docs:       ${(tpl.documents || []).map((d: any) => `[${d.documentId}] ${d.name}`).join(" | ")}`);
  console.log(
    `roles:      ${(recs.signers || [])
      .map((s: any) => `${s.roleName}(order=${s.routingOrder})`)
      .join(", ")}`,
  );

  if (detail) {
    for (const signer of recs.signers || []) {
      const tabs = signer.tabs || {};
      const counts: Record<string, number> = {};
      for (const k of Object.keys(tabs))
        if (Array.isArray(tabs[k])) counts[k] = tabs[k].length;
      console.log(`  role "${signer.roleName}" tabs:`, counts);
      for (const tabType of Object.keys(tabs)) {
        const arr = tabs[tabType];
        if (!Array.isArray(arr) || arr.length === 0) continue;
        const labels = arr.map((t: any) => t.tabLabel || t.name || "?");
        console.log(`    ${tabType}: ${labels.join(", ")}`);
      }
    }
  }
}

async function main() {
  const accessToken = await (docusignService as any).getAccessToken();
  const baseUrl = (docusignService as any).baseUrl;
  const accountId = (docusignService as any).accountId;

  // Flag: pass --detail to dump tabs per template
  const detail = process.argv.includes("--detail");
  // Flag: --only=PASS or --only=COMBO to restrict
  const onlyFlag = process.argv.find((a) => a.startsWith("--only="));
  const only = onlyFlag ? onlyFlag.split("=")[1] : null;

  for (const t of TEMPLATES) {
    const id = process.env[t.envVar];
    if (!id) {
      console.log(`\n[${t.label}] ${t.envVar} not set, skipping`);
      continue;
    }
    if (only && !t.label.toUpperCase().includes(only.toUpperCase())) continue;
    await inspectTemplate(id, t.label, baseUrl, accountId, accessToken, detail);
  }
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
