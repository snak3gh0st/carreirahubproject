/**
 * Delete all invoices and contracts for test/internal users.
 *
 * Targets:
 *   - loureiropaulo@gmail.com (Paulo Loureiro)
 *   - phdemelo888@gmail.com (Philipe Melo)
 *
 * Usage:
 *   npx tsx scripts/delete-test-invoices-contracts.ts
 *   npx tsx scripts/delete-test-invoices-contracts.ts --dry-run
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry-run");

const TARGET_EMAILS = ["loureiropaulo@gmail.com", "phdemelo888@gmail.com"];

async function main() {
  const { prisma } = require("../lib/db");

  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE DELETE"}\n`);

  const customers = await prisma.customer.findMany({
    where: { email: { in: TARGET_EMAILS } },
    select: { id: true, email: true, name: true },
  });

  if (customers.length === 0) {
    console.log("No matching customers found.");
    return;
  }

  console.log(`Found ${customers.length} customer(s):`);
  for (const c of customers) {
    console.log(`  • ${c.name} <${c.email}> (${c.id})`);
  }
  console.log("");

  const customerIds = customers.map((c: any) => c.id);

  const invoiceCount = await prisma.invoice.count({ where: { customerId: { in: customerIds } } });
  const contractCount = await prisma.contract.count({ where: { customerId: { in: customerIds } } });

  console.log(`Invoices to delete: ${invoiceCount}`);
  console.log(`Contracts to delete: ${contractCount}`);

  if (DRY_RUN) {
    console.log("\n[DRY RUN] No changes made. Remove --dry-run to execute.");
    return;
  }

  if (invoiceCount === 0 && contractCount === 0) {
    console.log("\nNothing to delete.");
    return;
  }

  console.log("\nDeleting...");

  // Contracts first (they may have no FK dep on invoices, but safe order)
  const deletedContracts = await prisma.contract.deleteMany({
    where: { customerId: { in: customerIds } },
  });
  console.log(`  ✅ Deleted ${deletedContracts.count} contract(s)`);

  const deletedInvoices = await prisma.invoice.deleteMany({
    where: { customerId: { in: customerIds } },
  });
  console.log(`  ✅ Deleted ${deletedInvoices.count} invoice(s)`);

  console.log("\nDone.");
  await prisma.$disconnect();
}

main().catch((err: Error) => {
  console.error("Error:", err);
  process.exit(1);
});
