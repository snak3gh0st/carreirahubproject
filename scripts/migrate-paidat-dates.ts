import { prisma } from "@/lib/db";

interface InstallmentsData {
  quickbooks?: {
    txnDate?: string;
    syncDate?: string;
    balance?: number;
    totalAmt?: number;
  };
}

async function migratePaidAtDates() {
  console.log("Starting paidAt date migration using QB transaction dates...\n");

  try {
    // Get all PAID invoices
    const paidInvoices = await prisma.invoice.findMany({
      where: {
        status: "PAID",
        amountPaid: { not: null, gt: 0 },
      },
      select: {
        id: true,
        invoiceNumber: true,
        paidAt: true,
        installments: true,
        createdAt: true,
      },
    });

    console.log(`Found ${paidInvoices.length} PAID invoices to update\n`);

    let updatedCount = 0;
    let noQbDateCount = 0;

    for (const invoice of paidInvoices) {
      let newPaidAt: Date | null = null;

      // Try to extract QB transaction date
      if (invoice.installments) {
        const installments = invoice.installments as InstallmentsData;
        if (installments.quickbooks?.txnDate) {
          try {
            const qbDate = new Date(installments.quickbooks.txnDate);
            if (!isNaN(qbDate.getTime())) {
              newPaidAt = qbDate;
            }
          } catch (e) {
            // If QB date parsing fails, fall back to invoice creation date
          }
        }
      }

      // If no QB date found, use invoice creation date (conservative approach)
      if (!newPaidAt && invoice.createdAt) {
        newPaidAt = invoice.createdAt;
        noQbDateCount++;
      }

      if (newPaidAt) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { paidAt: newPaidAt },
        });
        updatedCount++;

        if (updatedCount % 500 === 0) {
          console.log(`  Progress: ${updatedCount}/${paidInvoices.length}`);
        }
      }
    }

    console.log(`\n✓ Updated ${updatedCount} invoices`);
    console.log(`  - ${updatedCount - noQbDateCount} using QB transaction dates`);
    console.log(`  - ${noQbDateCount} using invoice creation dates (fallback)`);

    // Get date distribution
    const dateStats = await prisma.invoice.findMany({
      where: { status: "PAID" },
      select: { paidAt: true },
    });

    const dateMap = new Map<string, number>();
    dateStats.forEach((inv) => {
      if (inv.paidAt) {
        const month = inv.paidAt.toISOString().substring(0, 7);
        dateMap.set(month, (dateMap.get(month) || 0) + 1);
      }
    });

    console.log("\n=== Revenue Distribution by Month ===");
    Array.from(dateMap.entries())
      .sort()
      .forEach(([month, count]) => {
        console.log(`  ${month}: ${count} invoices`);
      });

    console.log("\nMigration complete! Revenue trend charts should now display properly.\n");
  } catch (error) {
    console.error("Error during migration:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migratePaidAtDates();
