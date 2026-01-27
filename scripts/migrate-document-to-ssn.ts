import { prisma } from "@/lib/db";

/**
 * Migrate data from document to ssn field
 * This script copies document values to ssn field
 */
async function migrateDocumentToSSN() {
  try {
    console.log("🔄 Starting migration: document -> ssn");

    // Find all customers with document but no ssn
    const customers = await prisma.customer.findMany({
      where: {
        document: { not: null },
        ssn: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        document: true,
      },
    });

    console.log(`Found ${customers.length} customers to migrate`);

    if (customers.length === 0) {
      console.log("✅ No customers to migrate");
      return;
    }

    // Migrate each customer
    let successCount = 0;
    let errorCount = 0;

    for (const customer of customers) {
      try {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { ssn: customer.document },
        });
        console.log(`✓ Migrated: ${customer.email} (${customer.document})`);
        successCount++;
      } catch (error: any) {
        console.error(`✗ Failed to migrate ${customer.email}:`, error.message);
        errorCount++;
      }
    }

    console.log("\n📊 Migration Summary:");
    console.log(`  ✓ Success: ${successCount}`);
    console.log(`  ✗ Errors: ${errorCount}`);
    console.log(`  Total: ${customers.length}`);

    console.log("\n✅ Migration complete!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrateDocumentToSSN()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
