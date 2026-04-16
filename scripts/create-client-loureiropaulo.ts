/**
 * One-off: Create Customer + ClientUser for loureiropaulo@gmail.com
 * and send welcome email with temp password.
 *
 * Bypasses Prisma (local .env.local points at dead Neon URL) — uses ssh+psql
 * directly on sigmadb for writes and Resend SDK directly for email.
 *
 * Run: npx tsx scripts/create-client-loureiropaulo.ts
 *
 * Idempotent: skips if ClientUser already exists.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { execFileSync } from "child_process";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Resend } from "resend";
import { renderBaseLayout, BRAND_COLORS } from "../lib/email/brand-layout";

const EMAIL = "loureiropaulo@gmail.com";
const NAME = "Paulo Loureiro";
const LOCALE = "pt-BR";
const BCRYPT_ROUNDS = 12;

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
}

function psql(sql: string): string {
  // Use ssh sigmadb + sudo -u postgres psql with -q (quiet) to suppress INSERT status line
  const cmd = `sudo -u postgres psql -d carreirahub -q -t -A -c "${sql.replace(/"/g, '\\"')}"`;
  const out = execFileSync("ssh", ["sigmadb", cmd], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  }).trim();
  // Return only first non-empty line (drops any trailing status lines)
  return out.split("\n").map((l) => l.trim()).filter(Boolean)[0] || "";
}

function sqlEscape(s: string): string {
  return s.replace(/'/g, "''");
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function main() {
  // 1. Check if customer exists
  console.log(`→ Checando Customer ${EMAIL}...`);
  const existingCustomerId = psql(
    `SELECT id FROM customers WHERE email = '${sqlEscape(EMAIL)}';`
  );

  let customerId: string;
  if (existingCustomerId) {
    customerId = existingCustomerId;
    console.log(`  já existe: ${customerId}`);
  } else {
    customerId = psql(
      `INSERT INTO customers (id, email, name, "preferredLanguage", "createdAt", "updatedAt", "phoneVerified")
       VALUES (gen_random_uuid()::text, '${sqlEscape(EMAIL)}', '${sqlEscape(NAME)}', '${LOCALE}', NOW(), NOW(), false)
       RETURNING id;`
    );
    console.log(`  ✓ Customer criado: ${customerId}`);
  }

  // 2. Check if ClientUser exists
  console.log(`→ Checando ClientUser...`);
  const existingClientUserId = psql(
    `SELECT id FROM client_users WHERE email = '${sqlEscape(EMAIL)}';`
  );

  if (existingClientUserId) {
    console.log(
      `⚠ ClientUser já existe (id=${existingClientUserId}). Abortando — use fluxo /hub/reset-password para resetar senha.`
    );
    return;
  }

  // 3. Create ClientUser with temp password
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
  const clientUserId = `cu_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;

  psql(
    `INSERT INTO client_users (id, email, "passwordHash", "mustResetPw", "tempPasswordExpiresAt", "customerId", language, "failedLoginCount", "createdAt", "updatedAt")
     VALUES ('${clientUserId}', '${sqlEscape(EMAIL)}', '${sqlEscape(passwordHash)}', true, NOW() + INTERVAL '72 hours', '${customerId}', '${LOCALE}', 0, NOW(), NOW());`
  );
  console.log(`  ✓ ClientUser criado: ${clientUserId}`);

  // 4. Send welcome email via Resend (standalone, no Prisma)
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("✗ RESEND_API_KEY ausente — email NÃO enviado.");
    console.log(`  Credenciais manuais:`);
    console.log(`    Email: ${EMAIL}`);
    console.log(`    Senha: ${tempPassword}`);
    return;
  }

  const resend = new Resend(apiKey);
  const from = "Carreira USA <noreply@carreirausa.com>";
  const loginUrl = "https://clientscarreira.sigmaintel.io/hub/login?account=created";
  const firstName = NAME.split(" ")[0];

  const bodyHtml = `
    <p>Olá, ${esc(firstName)}!</p>
    <p>Sua conta foi criada com sucesso. Use as credenciais abaixo para acessar seu portal.</p>
    <div style="background:${BRAND_COLORS.creme}; border:1px solid ${BRAND_COLORS.cafeLeite}; border-radius:8px; padding:18px; margin:18px 0;">
      <div style="font-size:12px; color:${BRAND_COLORS.textMuted}; text-transform:uppercase; font-weight:bold; letter-spacing:0.5px; margin-bottom:8px;">Seu acesso temporário</div>
      <div style="font-size:15px; margin-bottom:6px;"><strong>E-mail:</strong> ${esc(EMAIL)}</div>
      <div style="font-size:15px;"><strong>Senha temporária:</strong> <span style="font-family:monospace; background:${BRAND_COLORS.white}; padding:3px 8px; border-radius:4px; border:1px solid ${BRAND_COLORS.cafeLeite};">${esc(tempPassword)}</span></div>
    </div>
    <p style="font-size:13px; color:${BRAND_COLORS.textMuted};">Você será solicitado(a) a criar uma senha definitiva no primeiro acesso. Link válido por 72h.</p>
  `;

  const html = renderBaseLayout({
    title: "Bem-vindo(a) à Carreira USA",
    preheader: "Sua conta foi criada — acesse seu portal",
    bodyHtml,
    ctaLabel: "Acessar portal",
    ctaUrl: loginUrl,
  });

  const result = await resend.emails.send({
    from,
    to: [EMAIL],
    subject: "Bem-vindo(a) à Carreira USA — Acesse seu portal",
    html,
  });

  if (result.error) {
    console.error("✗ Email falhou:", result.error);
    console.log(`  Credenciais manuais:`);
    console.log(`    Email: ${EMAIL}`);
    console.log(`    Senha: ${tempPassword}`);
    console.log(`    Login: ${loginUrl}`);
    return;
  }

  console.log(`✓ Welcome email enviado. Resend ID: ${result.data?.id}`);
  console.log(`  (senha temp também impressa acima no bcrypt — NÃO loggar em prod)`);
}

main().catch((err) => {
  console.error("✗ Erro:", err);
  process.exit(1);
});
