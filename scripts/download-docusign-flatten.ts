/**
 * Download a DocuSign envelope's combined PDF with form fields flattened
 * (so prefill values are rendered as real text, like a signed contract).
 * Usage: npx tsx scripts/download-docusign-flatten.ts <envelopeId>
 */
import { config } from "dotenv";
import fs from "fs";
import path from "path";
config({ path: ".env.local" });

async function main() {
  const envelopeId = process.argv[2];
  if (!envelopeId) throw new Error("Pass envelopeId as arg");

  const { docusignService } = require("../lib/services/docusign.service");
  const svc: any = docusignService;
  const token = await svc.getAccessToken();

  // DocuSign supports ?show_changes=true which flattens the doc, and
  // ?certificate=false to skip the cert-of-completion page.
  const url = `${svc.baseUrl}/restapi/v2.1/accounts/${svc.accountId}/envelopes/${envelopeId}/documents/combined?certificate=false&show_changes=true&watermark=false`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Failed: ${res.status} ${await res.text()}`);

  const buf = Buffer.from(await res.arrayBuffer());
  const out = path.join(process.cwd(), `tmp-docusign-flat-${envelopeId}.pdf`);
  fs.writeFileSync(out, buf);
  console.log(`Saved -> ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
