/**
 * Generates a DocuSign envelope from the current template using Murilo's
 * real invoice/customer data (but routes the signer email to a safe inbox),
 * then downloads the combined PDF so we can inspect field positioning.
 *
 * Usage:
 *   npx tsx scripts/test-docusign-template.ts [signerEmail]
 *
 * Default signer email: loureiropaulo@gmail.com
 */
import { config } from "dotenv";
import fs from "fs";
import path from "path";
config({ path: ".env.local" });

async function main() {
  const { prisma } = require("../lib/db");
  const { docusignService } = require("../lib/services/docusign.service");

  const safeSignerEmail = process.argv[2] || "loureiropaulo@gmail.com";

  const customer = await prisma.customer.findFirst({
    where: { name: { contains: "Murilo", mode: "insensitive" } },
  });
  if (!customer) throw new Error("Murilo customer not found");

  // Pick the most recent non-paid invoice (installment series)
  const invoice = await prisma.invoice.findFirst({
    where: { customerId: customer.id, status: { not: "PAID" } },
    include: { deal: true, customer: true },
    orderBy: { createdAt: "desc" },
  });
  if (!invoice) throw new Error("No invoice found for Murilo");

  console.log(`[TEST] Customer: ${customer.name} <${customer.email}>`);
  console.log(`[TEST] Invoice:  ${invoice.invoiceNumber} ($${invoice.amount})`);
  console.log(`[TEST] Signer email overridden -> ${safeSignerEmail}`);
  console.log(`[TEST] Template will be resolved from lineItems/deal.title`);

  // Override signer email so the DocuSign notification does NOT go to Murilo.
  // All textTab values (name, address, SSN, amounts) remain REAL so the
  // rendered layout matches what a real envelope for him would look like.
  const customerForSigner = { ...customer, email: safeSignerEmail };

  const envelopeId = await docusignService.createEnvelopeFromTemplate(
    invoice,
    customerForSigner
  );
  console.log(`[TEST] Envelope created: ${envelopeId}`);

  // Small delay so DocuSign has the combined PDF rendered.
  await new Promise((r) => setTimeout(r, 3000));

  const pdf = await docusignService.downloadDocument(envelopeId, "combined");
  const outPath = path.join(
    process.cwd(),
    `tmp-docusign-test-${envelopeId}.pdf`
  );
  fs.writeFileSync(outPath, pdf);
  console.log(`[TEST] Combined PDF saved -> ${outPath}`);
  console.log(`[TEST] Envelope ID for later voiding: ${envelopeId}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
