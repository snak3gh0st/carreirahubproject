import { prisma } from "@/lib/db";
import { Alert, AlertStatus, AlertSeverity, InvoiceStatus } from "@prisma/client";

interface AlertCheckResult {
  shouldAlert: boolean;
  title: string;
  description: string;
  data: Record<string, any>;
}

/**
 * Alert Service - Evaluates alert rules and manages alert lifecycle
 *
 * Responsible for:
 * - Evaluating alert rules against current data
 * - Creating, acknowledging, resolving, dismissing alerts
 * - Preventing duplicate alerts
 * - Auto-resolving alerts when conditions are met
 */
export class AlertsService {
  /**
   * Check and create alerts for overdue invoices (>30 days past due)
   */
  async checkOverdueInvoices(): Promise<void> {
    try {
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Find invoices overdue by more than 30 days
      const overdueInvoices = await prisma.invoice.findMany({
        where: {
          status: { in: [InvoiceStatus.OVERDUE, InvoiceStatus.SENT] },
          dueDate: { lt: thirtyDaysAgo },
          markedOverdueAt: null,
        },
        include: {
          customer: true,
          deal: true,
        },
      });

      for (const invoice of overdueInvoices) {
        const daysOverdue = Math.floor(
          (today.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if active alert already exists
        const existingAlert = await prisma.alert.findFirst({
          where: {
            invoiceId: invoice.id,
            rule: { name: "Overdue Invoices Alert" },
            status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
          },
        });

        if (!existingAlert) {
          // Create new alert
          const rule = await prisma.alertRule.findUnique({
            where: { name: "Overdue Invoices Alert" },
          });

          if (rule) {
            await prisma.alert.create({
              data: {
                ruleId: rule.id,
                title: `Invoice Overdue: ${invoice.invoiceNumber || "Unknown"}`,
                description: `Invoice for ${invoice.customer?.name || "Unknown Customer"} is ${daysOverdue} days overdue. Amount: $${Number(invoice.amount).toFixed(2)}`,
                severity: daysOverdue > 60 ? AlertSeverity.CRITICAL : AlertSeverity.HIGH,
                invoiceId: invoice.id,
                customerId: invoice.customerId,
                dealId: invoice.dealId,
                data: {
                  daysOverdue,
                  amount: invoice.amount,
                  customerName: invoice.customer?.name,
                  dueDate: invoice.dueDate.toISOString(),
                },
              },
            });
          }
        }
      }

      // Auto-resolve alerts for invoices that are now paid
      await prisma.alert.updateMany({
        where: {
          rule: { name: "Overdue Invoices Alert" },
          status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
          invoice: { status: InvoiceStatus.PAID },
        },
        data: {
          status: AlertStatus.RESOLVED,
          resolvedAt: new Date(),
        },
      });
    } catch (error) {
      console.error("[AlertsService] Error checking overdue invoices:", error);
    }
  }

  /**
   * Check for high-value deals at risk (>$10k, no activity 30 days)
   */
  async checkHighValueDealsAtRisk(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Find high-value open deals that haven't been updated
      const riskydeal = await prisma.deal.findMany({
        where: {
          status: "OPEN",
          value: { gte: 10000 },
          updatedAt: { lt: thirtyDaysAgo },
        },
        include: {
          customer: true,
          owner: true,
        },
      });

      for (const deal of (riskydeal as any)) {
        // Check if active alert already exists
        const existingAlert = await prisma.alert.findFirst({
          where: {
            dealId: deal.id,
            rule: { name: "High-Value Deals at Risk" },
            status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
          },
        });

        if (!existingAlert) {
          const rule = await prisma.alertRule.findUnique({
            where: { name: "High-Value Deals at Risk" },
          });

          if (rule) {
            const daysSinceUpdate = Math.floor(
              (Date.now() - new Date(deal.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
            );

            await prisma.alert.create({
              data: {
                ruleId: rule.id,
                title: `High-Value Deal at Risk: ${deal.title}`,
                description: `Deal worth $${Number(deal.value).toFixed(2)} for ${deal.customer?.name || "Unknown"} hasn't been updated in ${daysSinceUpdate} days. Owner: ${deal.owner?.name || "Unassigned"}`,
                severity: AlertSeverity.MEDIUM,
                dealId: deal.id,
                customerId: deal.customerId,
                data: {
                  dealValue: deal.value,
                  daysSinceUpdate,
                  customerName: deal.customer?.name,
                  ownerName: deal.owner?.name,
                  lastUpdate: deal.updatedAt.toISOString(),
                },
              },
            });
          }
        }
      }

      // Auto-resolve alerts for deals that are now won or lost
      await prisma.alert.updateMany({
        where: {
          rule: { name: "High-Value Deals at Risk" },
          status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
          deal: { status: { in: ["WON", "LOST"] } },
        },
        data: {
          status: AlertStatus.RESOLVED,
          resolvedAt: new Date(),
        },
      });
    } catch (error) {
      console.error("[AlertsService] Error checking high-value deals:", error);
    }
  }

  /**
   * Check collection rate for the current month (target: 70%)
   */
  async checkLowCollectionRate(): Promise<void> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Calculate this month's invoices and payments
      const thisMonthInvoices = await prisma.invoice.findMany({
        where: {
          createdAt: { gte: startOfMonth },
        },
        select: {
          amount: true,
          amountPaid: true,
        },
      });

      if (thisMonthInvoices.length === 0) {
        return; // No invoices this month
      }

      const totalInvoiced = thisMonthInvoices.reduce(
        (sum, inv) => sum + Number(inv.amount),
        0
      );
      const totalPaid = thisMonthInvoices.reduce(
        (sum, inv) => sum + Number(inv.amountPaid || 0),
        0
      );

      const collectionRate = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0;

      // Check if alert should be created
      if (collectionRate < 70) {
        const rule = await prisma.alertRule.findUnique({
          where: { name: "Low Collection Rate" },
        });

        if (rule) {
          // Check if alert already exists for this month
          const existingAlert = await prisma.alert.findFirst({
            where: {
              rule: { name: "Low Collection Rate" },
              status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
              createdAt: { gte: startOfMonth },
            },
          });

          if (!existingAlert) {
            await prisma.alert.create({
              data: {
                ruleId: rule.id,
                title: "Low Collection Rate This Month",
                description: `Collection rate for ${now.toLocaleString("en-US", { month: "long" })} is ${collectionRate.toFixed(1)}%. Target: 70%. Invoiced: $${totalInvoiced.toFixed(2)}, Paid: $${totalPaid.toFixed(2)}`,
                severity: AlertSeverity.MEDIUM,
                data: {
                  collectionRate: collectionRate.toFixed(1),
                  totalInvoiced,
                  totalPaid,
                  month: now.toLocaleString("en-US", { month: "long", year: "numeric" }),
                },
              },
            });
          }
        }
      } else {
        // Auto-resolve existing low collection rate alert if rate improved
        await prisma.alert.updateMany({
          where: {
            rule: { name: "Low Collection Rate" },
            status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
            createdAt: { gte: startOfMonth },
          },
          data: {
            status: AlertStatus.RESOLVED,
            resolvedAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.error("[AlertsService] Error checking collection rate:", error);
    }
  }

  /**
   * Check for inactive customers (no activity in 60+ days)
   */
  async checkInactiveCustomers(): Promise<void> {
    try {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

      // Find customers with no recent invoices
      const inactiveCustomers = await prisma.customer.findMany({
        where: {
          invoices: {
            none: {
              createdAt: { gte: sixtyDaysAgo },
            },
          },
        },
      });

      for (const customer of inactiveCustomers) {
        // Check if alert already exists
        const existingAlert = await prisma.alert.findFirst({
          where: {
            customerId: customer.id,
            rule: { name: "Customer Churn Warning" },
            status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
          },
        });

        if (!existingAlert) {
          const rule = await prisma.alertRule.findUnique({
            where: { name: "Customer Churn Warning" },
          });

          if (rule) {
            // Get last invoice date
            const lastInvoice = await prisma.invoice.findFirst({
              where: { customerId: customer.id },
              orderBy: { createdAt: "desc" },
              select: { createdAt: true },
            });

            const daysSinceActivity = lastInvoice
              ? Math.floor(
                  (Date.now() - new Date(lastInvoice.createdAt).getTime()) / (1000 * 60 * 60 * 24)
                )
              : null;

            await prisma.alert.create({
              data: {
                ruleId: rule.id,
                title: `Inactive Customer: ${customer.name}`,
                description: `${customer.name} has had no invoices for 60+ days. Last invoice: ${daysSinceActivity ? `${daysSinceActivity} days ago` : "Never"}. Consider reaching out for re-engagement.`,
                severity: AlertSeverity.LOW,
                customerId: customer.id,
                data: {
                  customerName: customer.name,
                  customerEmail: customer.email,
                  daysSinceActivity,
                },
              },
            });
          }
        }
      }
    } catch (error) {
      console.error("[AlertsService] Error checking inactive customers:", error);
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId?: string): Promise<Alert | null> {
    try {
      const alert = await prisma.alert.update({
        where: { id: alertId },
        data: {
          status: AlertStatus.ACKNOWLEDGED,
          acknowledgedAt: new Date(),
        },
      });

      // Log the event
      if (alert) {
        await prisma.alertEvent.create({
          data: {
            alertId: alert.id,
            eventType: "ACKNOWLEDGED",
            actor: userId || "SYSTEM",
            previousStatus: AlertStatus.ACTIVE,
            newStatus: AlertStatus.ACKNOWLEDGED,
          },
        });
      }

      return alert;
    } catch (error) {
      console.error("[AlertsService] Error acknowledging alert:", error);
      return null;
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<Alert | null> {
    try {
      const alert = await prisma.alert.update({
        where: { id: alertId },
        data: {
          status: AlertStatus.RESOLVED,
          resolvedAt: new Date(),
        },
      });

      if (alert) {
        await prisma.alertEvent.create({
          data: {
            alertId: alert.id,
            eventType: "RESOLVED",
            actor: "SYSTEM",
            previousStatus: AlertStatus.ACKNOWLEDGED,
            newStatus: AlertStatus.RESOLVED,
          },
        });
      }

      return alert;
    } catch (error) {
      console.error("[AlertsService] Error resolving alert:", error);
      return null;
    }
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(limit: number = 20) {
    try {
      return await prisma.alert.findMany({
        where: {
          status: { in: [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED] },
        },
        include: {
          rule: true,
          invoice: true,
          customer: true,
          deal: true,
        },
        orderBy: [{ severity: "desc" }, { triggeredAt: "desc" }],
        take: limit,
      });
    } catch (error) {
      console.error("[AlertsService] Error getting active alerts:", error);
      return [];
    }
  }

  /**
   * Evaluate all enabled alert rules
   */
  async evaluateAllRules(): Promise<void> {
    try {
      console.log("[AlertsService] Starting alert evaluation...");

      // Get all enabled rules
      const rules = await prisma.alertRule.findMany({
        where: { enabled: true },
      });

      // Evaluate rules based on check interval
      const now = new Date();
      for (const rule of rules) {
        const shouldCheck = this.shouldCheckRule(rule.checkInterval, rule.lastEvaluatedAt);

        if (!shouldCheck) {
          continue;
        }

        console.log(`[AlertsService] Evaluating rule: ${rule.name}`);

        switch (rule.name) {
          case "Overdue Invoices Alert":
            await this.checkOverdueInvoices();
            break;
          case "High-Value Deals at Risk":
            await this.checkHighValueDealsAtRisk();
            break;
          case "Low Collection Rate":
            await this.checkLowCollectionRate();
            break;
          case "Customer Churn Warning":
            await this.checkInactiveCustomers();
            break;
        }

        // Update last evaluated time
        await prisma.alertRule.update({
          where: { id: rule.id },
          data: { lastEvaluatedAt: now },
        });
      }

      console.log("[AlertsService] Alert evaluation completed");
    } catch (error) {
      console.error("[AlertsService] Error evaluating alert rules:", error);
    }
  }

  /**
   * Determine if a rule should be checked based on interval
   */
  private shouldCheckRule(interval: string, lastEvaluatedAt: Date | null): boolean {
    if (!lastEvaluatedAt) {
      return true; // First time, always check
    }

    const now = new Date();
    const diffMs = now.getTime() - lastEvaluatedAt.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffHours / 24;

    switch (interval) {
      case "HOURLY":
        return diffHours >= 1;
      case "DAILY":
        return diffDays >= 1;
      case "WEEKLY":
        return diffDays >= 7;
      default:
        return false;
    }
  }
}

// Singleton export
export const alertsService = new AlertsService();
