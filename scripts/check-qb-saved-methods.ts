import { quickbooksService } from "@/lib/services/quickbooks.service";

async function main() {
  await quickbooksService.initialize();
  const qbCustomerId = process.argv[2];
  if (!qbCustomerId) {
    console.error("Uso: npx tsx -r dotenv/config scripts/check-qb-saved-methods.ts <qbCustomerId> dotenv_config_path=.env.local");
    process.exit(1);
  }

  console.log(`\n=== Cards for QB customer ${qbCustomerId} ===`);
  try {
    const cards = await (quickbooksService as any).paymentsRequest(
      `/customers/${qbCustomerId}/cards`
    );
    console.log(JSON.stringify(cards, null, 2));
  } catch (e: any) {
    console.error("cards error:", e.message);
  }

  console.log(`\n=== Bank accounts for QB customer ${qbCustomerId} ===`);
  try {
    const banks = await (quickbooksService as any).paymentsRequest(
      `/customers/${qbCustomerId}/bank-accounts`
    );
    console.log(JSON.stringify(banks, null, 2));
  } catch (e: any) {
    console.error("bank-accounts error:", e.message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
