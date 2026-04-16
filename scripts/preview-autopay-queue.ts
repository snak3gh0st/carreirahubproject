/**
 * Mostra quais invoices seriam cobradas pelo cron auto-charge-invoices
 * no próximo run — sem cobrar, só pra preview.
 */
import { prisma } from "@/lib/db";
import { InvoiceStatus } from "@prisma/client";
import { quickbooksService } from "@/lib/services/quickbooks.service";

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const invoices = await prisma.invoice.findMany({
    where: {
      amount: { gt: 0 },
      dueDate: { gte: today, lt: tomorrow },
      status: InvoiceStatus.SENT,
      autoChargeStatus: null,
    },
    include: { customer: true },
    take: 50,
    orderBy: { dueDate: "asc" },
  });

  console.log(`\n=== ${invoices.length} invoice(s) candidatas a autopay hoje ===\n`);

  if (!invoices.length) {
    console.log("Nenhuma invoice com dueDate=hoje + SENT + autoChargeStatus=null.");
    return;
  }

  await quickbooksService.initialize();

  let wouldCharge = 0;
  let wouldSkip = 0;

  for (const inv of invoices) {
    const qbId = inv.customer.quickbooks_id;
    if (!qbId) {
      console.log(`SKIP  ${inv.invoiceNumber || inv.id.slice(0, 8)}  $${Number(inv.amount)}  ${inv.customer.name} — sem QB id`);
      wouldSkip++;
      continue;
    }

    let methods;
    try {
      methods = await quickbooksService.getCustomerPaymentMethods(qbId);
    } catch (e: any) {
      console.log(`ERR   ${inv.invoiceNumber || inv.id.slice(0, 8)}  lookup falhou: ${e.message}`);
      continue;
    }

    if (!methods.hasPaymentMethod) {
      console.log(`SKIP  ${inv.invoiceNumber || inv.id.slice(0, 8)}  $${Number(inv.amount)}  ${inv.customer.name} — sem método salvo`);
      wouldSkip++;
      continue;
    }

    const methodType = methods.cards.length > 0 ? "card" : "ach";
    const last4 = methods.cards.length > 0
      ? (methods.cards[0].number || "").slice(-4)
      : (methods.bankAccounts[0].accountNumber || "").slice(-4);
    const brand = methods.cards.length > 0 ? (methods.cards[0].cardType || "card") : "bank";

    console.log(`CHARGE ${inv.invoiceNumber || inv.id.slice(0, 8)}  $${Number(inv.amount)}  ${inv.customer.name} → ${brand} ••${last4}`);
    wouldCharge++;
  }

  console.log(`\n→ ${wouldCharge} cobranças reais, ${wouldSkip} puladas\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
