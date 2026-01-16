import { prisma } from "@/lib/db";

async function migrateAmountPaid() {
  console.log("Starting amountPaid migration...\n");

  try {
    // Get all invoices with null amountPaid
    const invoicesToUpdate = await prisma.invoice.findMany({
      where: {
        amountPaid: { equals: null },
      },
      select: { id: true, amount: true, status: true },
    });

    console.log(`Found ${invoicesToUpdate.length} invoices to update\n`);

    let updatedCount = 0;

    // Update each invoice based on its status
    for (const invoice of invoicesToUpdate) {
      let amountPaid = 0;

      if (invoice.status === "PAID") {
        // Full payment
        amountPaid = Number(invoice.amount);
      } else if (invoice.status === "PARTIALLY_PAID") {
        // Conservative estimate: half payment
        amountPaid = Number(invoice.amount) / 2;
      }
      // For SENT, OVERDUE, DRAFT, VOID: amountPaid stays 0

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: amountPaid > 0 ? amountPaid : null,
          paidAt: amountPaid > 0 ? new Date() : null,
        },
      });

      updatedCount++;
      if (updatedCount % 500 === 0) {
        console.log(`  Progress: ${updatedCount}/${invoicesToUpdate.length}`);
      }
    }

    console.log(`\n✓ Updated ${updatedCount} invoices`);

    // Verify the results
    const stats = await prisma.invoice.groupBy({
      by: ["status"],
      _count: { id: true },
      _sum: { amountPaid: true },
    });

    console.log("\n=== Migration complete! Summary by status ===");
    stats.forEach((s) => {
      console.log(
        `  ${s.status}: ${s._count.id} invoices | Total Paid: $${Number(s._sum.amountPaid || 0).toFixed(2)}`
      );
    });

    // Show overall totals
    const totals = await prisma.invoice.aggregate({
      _sum: { amount: true, amountPaid: true },
    });

    console.log(
      `\nTotal Invoiced: $${Number(totals._sum.amount || 0).toFixed(2)}`
    );
    console.log(
      `Total Paid: $${Number(totals._sum.amountPaid || 0).toFixed(2)}`
    );

    const collectionRate =
      (Number(totals._sum.amountPaid || 0) /
        Number(totals._sum.amount || 1)) *
      100;
    console.log(`Collection Rate: ${collectionRate.toFixed(1)}%\n`);
  } catch (error) {
    console.error("Error during migration:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateAmountPaid();
