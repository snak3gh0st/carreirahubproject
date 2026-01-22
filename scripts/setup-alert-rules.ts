import { PrismaClient, AlertSeverity } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Setup script to initialize default alert rules
 * Run with: npx ts-node scripts/setup-alert-rules.ts
 */

const DEFAULT_RULES = [
  {
    name: "Overdue Invoices Alert",
    description: "Alert when any invoice is more than 30 days overdue",
    severity: AlertSeverity.HIGH,
    condition: "invoices.overdueAmount > 0 AND invoices.maxOverdueDays > 30",
    checkInterval: "DAILY",
    autoResolveCondition: "invoice.status = 'PAID'",
  },
  {
    name: "Invoice Pending Approval",
    description: "Alert when invoice is pending approval for more than 48 hours",
    severity: AlertSeverity.MEDIUM,
    condition: "invoice.approvalStatus = 'PENDING' AND invoice.hoursPending > 48",
    checkInterval: "DAILY",
    autoResolveCondition: "invoice.approvalStatus IN ('APPROVED', 'REJECTED')",
  },
  {
    name: "High-Value Deals at Risk",
    description: "Alert when deals >$10k haven't been updated in 30 days",
    severity: AlertSeverity.MEDIUM,
    condition: "deals.value >= 10000 AND deals.daysSinceChange >= 30 AND deals.status = 'OPEN'",
    checkInterval: "DAILY",
    autoResolveCondition: "deal.status IN ('WON', 'LOST')",
  },
  {
    name: "Low Collection Rate",
    description: "Alert when monthly collection rate falls below 70%",
    severity: AlertSeverity.MEDIUM,
    condition: "monthly.collectionRate < 0.70",
    checkInterval: "WEEKLY",
    autoResolveCondition: "monthly.collectionRate >= 0.70",
  },
  {
    name: "Customer Churn Warning",
    description: "Alert for customers with no activity in 60+ days",
    severity: AlertSeverity.LOW,
    condition: "customers.daysSinceLastInvoice >= 60",
    checkInterval: "WEEKLY",
    autoResolveCondition: "customer.lastInvoiceDate < 60 days ago",
  },
];

async function setupAlertRules() {
  try {
    console.log("Setting up default alert rules...");

    for (const rule of DEFAULT_RULES) {
      const existing = await prisma.alertRule.findUnique({
        where: { name: rule.name },
      });

      if (existing) {
        console.log(`✓ Rule "${rule.name}" already exists`);
        continue;
      }

      const created = await prisma.alertRule.create({
        data: {
          name: rule.name,
          description: rule.description,
          severity: rule.severity,
          condition: rule.condition,
          checkInterval: rule.checkInterval,
          autoResolveCondition: rule.autoResolveCondition,
          enabled: true,
          maxAlertsPerDay: 1,
        },
      });

      console.log(`✓ Created rule: "${created.name}"`);
    }

    console.log("\nAlert rules setup completed!");
  } catch (error) {
    console.error("Error setting up alert rules:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupAlertRules();
