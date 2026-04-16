/**
 * Testa 4 variantes do POST /customers/{id}/cards pra descobrir
 * por que o QB Payments prod retorna 404 pro save de cartão.
 *
 * Uso: npx tsx -r dotenv/config scripts/test-qb-card-save-variants.ts [qbCustomerId] dotenv_config_path=.env.local
 */
import { quickbooksService } from "@/lib/services/quickbooks.service";

const qbCustomerId = process.argv[2];
if (!qbCustomerId) {
  console.error("Uso: npx tsx -r dotenv/config scripts/test-qb-card-save-variants.ts <qbCustomerId> dotenv_config_path=.env.local");
  process.exit(1);
}

async function rawPaymentsPost(endpoint: string, body: any, label: string) {
  const svc = quickbooksService as any;
  const url = `${svc.paymentsBaseUrl}${endpoint}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${svc.accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "Request-Id": `test-${label}-${Date.now()}`,
  };
  console.log(`\n--- ${label} ---`);
  console.log("POST", url);
  console.log("body:", JSON.stringify(body, null, 2));
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log("status:", res.status);
  console.log("response:", text.slice(0, 800));
  return { status: res.status, text };
}

async function getFreshToken(): Promise<string> {
  return quickbooksService.tokenizeCard({
    number: "4111111111111111",
    expMonth: "12",
    expYear: "2030",
    cvc: "123",
    name: "Test Save",
    postalCode: "30301",
  });
}

async function main() {
  await quickbooksService.initialize();
  console.log(`QB customer id: ${qbCustomerId}`);

  // Sanity: list existing cards + bank accounts
  console.log("\n=== baseline: list existing methods ===");
  try {
    const cards = await quickbooksService.getCustomerCards(qbCustomerId);
    console.log("cards:", cards);
  } catch (e: any) {
    console.log("cards err:", e.message);
  }

  // ───── VARIANT 1: current code — just { token } ─────
  try {
    const t1 = await getFreshToken();
    await rawPaymentsPost(
      `/customers/${qbCustomerId}/cards`,
      { token: t1 },
      "V1-token-only"
    );
  } catch (e: any) {
    console.log("V1 threw:", e.message);
  }

  // ───── VARIANT 2: token + name + default flag ─────
  try {
    const t2 = await getFreshToken();
    await rawPaymentsPost(
      `/customers/${qbCustomerId}/cards`,
      { token: t2, isDefault: true },
      "V2-token-default"
    );
  } catch (e: any) {
    console.log("V2 threw:", e.message);
  }

  // ───── VARIANT 3: explicit card object (legacy shape, no tokenize) ─────
  try {
    await rawPaymentsPost(
      `/customers/${qbCustomerId}/cards`,
      {
        number: "4111111111111111",
        expMonth: "12",
        expYear: "2030",
        cvc: "123",
        name: "Test Card",
        address: { postalCode: "30301", country: "US" },
      },
      "V3-raw-card-body"
    );
  } catch (e: any) {
    console.log("V3 threw:", e.message);
  }

  // ───── VARIANT 4: try underscored customer path (some docs show /entity/) ─────
  try {
    const t4 = await getFreshToken();
    await rawPaymentsPost(
      `/customers/${qbCustomerId}/cards/`,
      { token: t4 },
      "V4-trailing-slash"
    );
  } catch (e: any) {
    console.log("V4 threw:", e.message);
  }

  // ───── Probe: does the customer exist in Payments namespace? ─────
  console.log("\n=== probe: does /customers/:id exist at all? ===");
  const svc = quickbooksService as any;
  const probeUrl = `${svc.paymentsBaseUrl}/customers/${qbCustomerId}`;
  const probe = await fetch(probeUrl, {
    headers: {
      Authorization: `Bearer ${svc.accessToken}`,
      Accept: "application/json",
    },
  });
  console.log("GET /customers/:id status:", probe.status);
  console.log("response:", (await probe.text()).slice(0, 400));

  // ───── Probe: list all customers in Payments ─────
  console.log("\n=== probe: GET /customers (list all) ===");
  const listUrl = `${svc.paymentsBaseUrl}/customers`;
  const listRes = await fetch(listUrl, {
    headers: {
      Authorization: `Bearer ${svc.accessToken}`,
      Accept: "application/json",
    },
  });
  console.log("status:", listRes.status);
  console.log("response:", (await listRes.text()).slice(0, 800));

  console.log("\n=== final: list cards again ===");
  const final = await quickbooksService.getCustomerCards(qbCustomerId);
  console.log("cards after variants:", final);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
