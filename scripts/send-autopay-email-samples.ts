/**
 * Envia amostras dos 3 emails de autopay pro endereço especificado,
 * com dados fictícios, só pra revisão visual.
 *
 * Uso:
 *   npx tsx -r dotenv/config scripts/send-autopay-email-samples.ts [email] dotenv_config_path=.env.local
 */
import { emailService } from "@/lib/services/email.service";
import { prisma } from "@/lib/db";

async function main() {
  const to = process.argv[2] || "loureiropaulo@gmail.com";

  // Use real customer + invoice IDs so Notification FK doesn't break.
  const dbCustomer = await prisma.customer.findFirst({
    where: { email: to },
  });
  if (!dbCustomer) {
    throw new Error(
      `Customer with email ${to} not found in DB. Pass a customer email that exists.`
    );
  }
  const dbInvoice = await prisma.invoice.findFirst({
    where: { customerId: dbCustomer.id },
    orderBy: { createdAt: "desc" },
  });
  if (!dbInvoice) {
    throw new Error(
      `No invoice found for customer ${to} — create one first to use as reference.`
    );
  }

  const customer = {
    id: dbCustomer.id,
    email: to,
    name: dbCustomer.name,
  };

  const invoice = {
    id: dbInvoice.id,
    invoiceNumber: dbInvoice.invoiceNumber,
    amount: Number(dbInvoice.amount),
    dueDate: dbInvoice.dueDate,
  };

  const method = {
    type: "card" as const,
    last4: "2006",
    brand: "AMEX",
  };

  console.log(`Enviando 3 amostras de autopay pra ${to} ...`);

  // 1) Nova fatura com cobrança automática agendada
  await emailService.sendHubAutopayScheduled(customer, invoice, method);
  console.log("✅ 1/3 sendHubAutopayScheduled enviado");

  // 2) Recibo de pagamento automático
  await emailService.sendHubAutopayReceipt(customer, invoice, method);
  console.log("✅ 2/3 sendHubAutopayReceipt enviado");

  // 3) Falha (não-final): retry agendado
  const nextRetry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  await emailService.sendHubAutopayFailed(customer, invoice, method, nextRetry, false);
  console.log("✅ 3/3 sendHubAutopayFailed (tentativa intermediária) enviado");

  // 3b) Falha final (esgotamento de tentativas) — bonus
  await emailService.sendHubAutopayFailed(customer, invoice, method, null, true);
  console.log("✅ 3b/3 sendHubAutopayFailed (FINAL - todas tentativas falharam) enviado");

  console.log(`\nTodos enviados pra ${to}. Cheque a caixa de entrada.`);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
