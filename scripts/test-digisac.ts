/**
 * Smoke test for Digisac integration.
 *
 * Usage:
 *   npm run test:digisac
 *   npm run test:digisac -- --to=5511XXXXXXXXX --text="ping"
 *
 * Loads .env.local then .env, validates config, pings the Digisac API
 * read-only to verify the token, and optionally sends a real test message
 * when --to and --text are provided. Test messages use dontOpenTicket=true
 * so they don't pollute the support inbox.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { getDigisacConfig, sendDigisacMessage } from "../lib/services/digisac.service";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

async function main(): Promise<void> {
  const cfg = getDigisacConfig();

  console.log("\n=== Digisac Config ===");
  console.log(`API base:   ${cfg.apiBaseUrl ?? "<missing>"}`);
  console.log(`Token:      ${cfg.apiToken ? `${cfg.apiToken.slice(0, 6)}…` : "<missing>"}`);
  console.log(`Service ID: ${cfg.serviceId ?? "<missing>"}`);
  console.log(`Workspace:  ${cfg.workspaceUrl ?? "<derived>"}`);
  console.log(`Country:    ${cfg.defaultCountryCode}`);
  console.log(`Enabled:    ${cfg.enabled}`);

  if (!cfg.enabled) {
    console.error(`\n❌ Missing env vars: ${cfg.missing.join(", ")}`);
    process.exit(1);
  }

  console.log("\n=== Ping API ===");
  const pingUrl = `${cfg.apiBaseUrl}/services/${cfg.serviceId}`;
  console.log(`GET ${pingUrl}`);
  const res = await fetch(pingUrl, {
    headers: { Authorization: `Bearer ${cfg.apiToken}` },
  });
  const body = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(`Body:   ${body.slice(0, 300)}${body.length > 300 ? "…" : ""}`);

  if (!res.ok) {
    console.error("\n❌ Auth failed or service ID is wrong. If 404, try GET /services (list) to find the correct service ID.");
    process.exit(1);
  }
  console.log("\n✅ Auth OK");

  const args = parseArgs(process.argv);
  if (args.to && args.text) {
    console.log("\n=== Send Test Message ===");
    console.log(`To:   ${args.to}`);
    console.log(`Text: ${args.text}`);
    const result = await sendDigisacMessage({
      number: args.to,
      text: args.text,
      dontOpenTicket: true,
    });
    console.log("\n✅ Sent:");
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("\n(skip envio — passe --to=5511XXXXXXXXX --text=oi pra testar envio real)");
  }
}

main().catch((err) => {
  console.error("\n❌ Falha:", err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
