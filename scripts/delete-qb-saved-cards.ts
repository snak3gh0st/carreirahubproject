/**
 * Deletes all saved cards + bank accounts for a QB customer.
 * Uso: npx tsx -r dotenv/config scripts/delete-qb-saved-cards.ts [qbCustomerId] dotenv_config_path=.env.local
 */
import { quickbooksService } from "@/lib/services/quickbooks.service";

async function main() {
  await quickbooksService.initialize();
  const qbCustomerId = process.argv[2];
  if (!qbCustomerId) {
    console.error("Uso: npx tsx -r dotenv/config scripts/delete-qb-saved-cards.ts <qbCustomerId> dotenv_config_path=.env.local");
    process.exit(1);
  }
  const svc = quickbooksService as any;

  console.log(`\n=== Cards for ${qbCustomerId} ===`);
  const cards = await quickbooksService.getCustomerCards(qbCustomerId);
  console.log(`Found ${cards.length} card(s)`);

  for (const c of cards) {
    const url = `${svc.paymentsBaseUrl}/customers/${qbCustomerId}/cards/${c.id}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${svc.accessToken}`,
        Accept: "application/json",
        "Request-Id": `del-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      },
    });
    console.log(`DELETE card ${c.id} (${c.number}) → ${res.status}`);
    if (!res.ok) console.log("  body:", (await res.text()).slice(0, 300));
  }

  console.log(`\n=== Bank accounts for ${qbCustomerId} ===`);
  const banks = await quickbooksService.getCustomerBankAccounts(qbCustomerId);
  console.log(`Found ${banks.length} bank account(s)`);
  for (const b of banks) {
    const url = `${svc.paymentsBaseUrl}/customers/${qbCustomerId}/bank-accounts/${b.id}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${svc.accessToken}`,
        Accept: "application/json",
        "Request-Id": `del-ach-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      },
    });
    console.log(`DELETE bank-account ${b.id} → ${res.status}`);
    if (!res.ok) console.log("  body:", (await res.text()).slice(0, 300));
  }

  console.log(`\n=== Final verification ===`);
  const cardsAfter = await quickbooksService.getCustomerCards(qbCustomerId);
  const banksAfter = await quickbooksService.getCustomerBankAccounts(qbCustomerId);
  console.log(`cards remaining: ${cardsAfter.length}`);
  console.log(`bank accounts remaining: ${banksAfter.length}`);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
