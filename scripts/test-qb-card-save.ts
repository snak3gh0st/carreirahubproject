import { quickbooksService } from "@/lib/services/quickbooks.service";

async function main() {
  await quickbooksService.initialize();
  const qbCustomerId = process.argv[2];
  if (!qbCustomerId) {
    console.error("Uso: npx tsx -r dotenv/config scripts/test-qb-card-save.ts <qbCustomerId> dotenv_config_path=.env.local");
    process.exit(1);
  }

  console.log(`\n=== Step 1: tokenize test card (Visa 4111...) ===`);
  const token = await quickbooksService.tokenizeCard({
    number: "4111111111111111",
    expMonth: "12",
    expYear: "2030",
    cvc: "123",
    name: "Test Cardholder",
    postalCode: "30301",
  });
  console.log("token:", token);

  console.log(`\n=== Step 2: save card to customer ${qbCustomerId} ===`);
  const saved = await quickbooksService.createCardFromToken(qbCustomerId, token);
  console.log("raw response:", JSON.stringify(saved, null, 2));

  console.log(`\n=== Step 3: list cards for customer ${qbCustomerId} ===`);
  const cards = await quickbooksService.getCustomerCards(qbCustomerId);
  console.log("cards:", JSON.stringify(cards, null, 2));
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  if (e.response) console.error("response:", e.response);
  process.exit(1);
});
