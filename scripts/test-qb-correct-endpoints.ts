/**
 * Testa os endpoints corretos conforme o SDK oficial PHP do Intuit:
 *   POST /quickbooks/v4/customers/{id}/cards/createFromToken
 *   GET  /quickbooks/v4/customers/{id}/cards
 *   POST /quickbooks/v4/customers/{id}/bank-accounts/createFromToken
 *   GET  /quickbooks/v4/customers/{id}/bank-accounts
 *
 * Nota: base é /quickbooks/v4 (SEM /payments) — nosso código atual
 * está usando /quickbooks/v4/payments, que é errado pra /customers.
 */
import { quickbooksService } from "@/lib/services/quickbooks.service";

const qbCustomerId = process.argv[2];
if (!qbCustomerId) {
  console.error("Uso: npx tsx -r dotenv/config scripts/test-qb-correct-endpoints.ts <qbCustomerId> dotenv_config_path=.env.local");
  process.exit(1);
}
const API_BASE = "https://api.intuit.com/quickbooks/v4";

async function authedFetch(method: string, path: string, body?: any) {
  const svc = quickbooksService as any;
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${svc.accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "Request-Id": `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  console.log(`\n${method} ${url}`);
  if (body) console.log("body:", JSON.stringify(body).slice(0, 300));
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  console.log("status:", res.status);
  console.log("response:", text.slice(0, 800));
  try { return { status: res.status, json: JSON.parse(text) }; }
  catch { return { status: res.status, json: null, text }; }
}

async function main() {
  await quickbooksService.initialize();
  console.log(`Customer: ${qbCustomerId}`);

  // 1) GET cards
  await authedFetch("GET", `/customers/${qbCustomerId}/cards`);

  // 2) GET bank-accounts
  await authedFetch("GET", `/customers/${qbCustomerId}/bank-accounts`);

  // 3) Tokenize
  const token = await quickbooksService.tokenizeCard({
    number: "4111111111111111",
    expMonth: "12",
    expYear: "2030",
    cvc: "123",
    name: "Save Test",
    postalCode: "30301",
  });
  console.log("\ntoken:", token);

  // 4) POST /cards/createFromToken
  await authedFetch(
    "POST",
    `/customers/${qbCustomerId}/cards/createFromToken`,
    { value: token }
  );

  // 5) GET cards again to verify persistence
  await authedFetch("GET", `/customers/${qbCustomerId}/cards`);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
