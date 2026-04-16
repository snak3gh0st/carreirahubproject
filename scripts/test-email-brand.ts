/**
 * Test email — sends a brand-layout sample to loureiropaulo@gmail.com
 * using the new Carreira USA layout helper.
 *
 * Run: npx tsx scripts/test-email-brand.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { Resend } from "resend";
import { renderBaseLayout } from "../lib/email/brand-layout";

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  // Domain carreirausa.com is verified in Resend (confirmed 2026-04-14)
  // NOTE: .env.local has EMAIL_FROM=noreply@sigmaintel.io — wrong domain, needs fix
  const from = process.env.TEST_EMAIL_FROM || "Carreira USA <noreply@carreirausa.com>";
  const to = process.env.TEST_EMAIL_TO || "loureiropaulo@gmail.com";

  if (!apiKey) {
    console.error("❌ RESEND_API_KEY not set in .env.local");
    process.exit(1);
  }

  const resend = new Resend(apiKey);

  const bodyHtml = `
    <p style="font-size: 16px; margin: 0 0 16px;">Olá Paulo,</p>
    <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
      Este é um <strong>email de teste</strong> enviado pelo novo sistema de emails da Carreira USA
      para validar o layout com a paleta da marca v1.1 (Verde, Tangerina, Creme).
    </p>
    <div style="background: #FFF8E8; border: 1px solid #E1C19B; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 8px; font-size: 13px; color: #6B6358; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
        Verificação
      </p>
      <ul style="margin: 0; padding-left: 20px; color: #2F443F; font-size: 14px; line-height: 1.8;">
        <li>Header em Verde <code style="background:#fff;padding:1px 6px;border-radius:3px;">#2F443F</code></li>
        <li>CTA em Tangerina <code style="background:#fff;padding:1px 6px;border-radius:3px;">#FF8142</code></li>
        <li>Card destaque em Creme <code style="background:#fff;padding:1px 6px;border-radius:3px;">#FFF8E8</code></li>
        <li>Borda decorativa em Café com Leite <code style="background:#fff;padding:1px 6px;border-radius:3px;">#E1C19B</code></li>
      </ul>
    </div>
    <p style="font-size: 14px; color: #6B6B6B; margin: 0;">
      Enviado de <strong>${from}</strong> via Resend SDK.
    </p>
  `;

  const html = renderBaseLayout({
    title: "Teste de layout — Carreira USA",
    preheader: "Validação do novo sistema de emails com paleta da marca v1.1",
    bodyHtml,
    ctaLabel: "Visitar Dashboard",
    ctaUrl: "https://carreirausa.sigmaintel.io/dashboard",
    footerNote: "Email de teste — pode ignorar.",
  });

  console.log(`→ Enviando para ${to} via ${from}...`);

  const result = await resend.emails.send({
    from,
    to: [to],
    subject: "🧪 Teste — Layout Carreira USA v1.1",
    html,
  });

  if (result.error) {
    console.error("❌ Falha ao enviar:", result.error);
    process.exit(1);
  }

  console.log("✅ Enviado. Resend ID:", result.data?.id);
}

main().catch((err) => {
  console.error("❌ Erro:", err);
  process.exit(1);
});
