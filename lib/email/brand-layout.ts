/**
 * Carreira USA brand layout helper for transactional emails.
 *
 * Renders an email-client-safe (table-based) HTML shell using the v1.1
 * brand palette. The horizontal logo (white variant) is served from
 * /public/brand/logo-horizontal-white.png and referenced via absolute URL
 * so it loads in Gmail, Outlook, Apple Mail etc.
 *
 * Brand fonts (Blaak / Neue Montreal) are not email-safe, so Arial is
 * used as fallback everywhere.
 *
 * Usage:
 *   import { renderBaseLayout, BRAND_COLORS } from '@/lib/email/brand-layout';
 *   const html = renderBaseLayout({
 *     title: 'Fatura vencida',
 *     preheader: 'A fatura INV-001 venceu',
 *     bodyHtml: '<p>...</p>',
 *     ctaLabel: 'Ver fatura',
 *     ctaUrl: 'https://...'
 *   });
 *
 * IMPORTANT: bodyHtml is rendered as-is. Never accept untrusted user input
 * here without sanitization.
 */

export const BRAND_COLORS = {
  verde: '#2F443F',
  tangerina: '#FF8142',
  caramelo: '#BD925F',
  creme: '#FFF8E8',
  cafeLeite: '#E1C19B',
  textDark: '#2F443F',
  textMuted: '#6B6B6B',
  white: '#FFFFFF',
} as const;

export interface BaseLayoutOpts {
  /** Visible H1 in the header AND <title> tag */
  title: string;
  /** Hidden preview text shown in inbox preview pane */
  preheader?: string;
  /** Inner body content (already-rendered, trusted HTML) */
  bodyHtml: string;
  /** Optional primary CTA button label */
  ctaLabel?: string;
  /** Optional primary CTA button URL */
  ctaUrl?: string;
  /** Optional small footer note appended under the system signature */
  footerNote?: string;
}

const FONT_STACK = 'Arial, Helvetica, sans-serif';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'https://carreirausa.sigmaintel.io'
  ).replace(/\/$/, '');
}

export function renderBaseLayout(opts: BaseLayoutOpts): string {
  const { title, preheader, bodyHtml, ctaLabel, ctaUrl, footerNote } = opts;

  const safeTitle = escapeHtml(title);
  const safePreheader = preheader ? escapeHtml(preheader) : '';
  const baseUrl = getBaseUrl();
  const logoUrl = `${baseUrl}/brand/logo-horizontal-white.png`;
  const portalUrl = `${baseUrl}/hub/login`;
  const year = new Date().getFullYear();

  const preheaderBlock = preheader
    ? `<span style="display:none !important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; max-height:0; max-width:0; mso-hide:all; overflow:hidden;">${safePreheader}</span>`
    : '';

  const ctaBlock =
    ctaLabel && ctaUrl
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 8px 0;">
          <tr>
            <td align="center" bgcolor="${BRAND_COLORS.tangerina}" style="background-color:${BRAND_COLORS.tangerina}; border-radius:8px; box-shadow: 0 2px 6px rgba(255, 129, 66, 0.25);">
              <a href="${escapeHtml(ctaUrl)}" target="_blank" style="display:inline-block; padding:15px 34px; font-family:${FONT_STACK}; font-size:15px; font-weight:bold; color:${BRAND_COLORS.white}; text-decoration:none; border-radius:8px; letter-spacing:0.3px;">
                ${escapeHtml(ctaLabel)} &rarr;
              </a>
            </td>
          </tr>
        </table>`
      : '';

  const footerNoteBlock = footerNote
    ? `<div style="margin:8px 0 0 0; font-style:italic;">${escapeHtml(footerNote)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0; padding:0; background-color:${BRAND_COLORS.creme}; font-family:${FONT_STACK}; color:${BRAND_COLORS.textDark};">
  ${preheaderBlock}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND_COLORS.creme}; padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background-color:${BRAND_COLORS.white}; border-radius:12px; overflow:hidden; box-shadow: 0 2px 12px rgba(47, 68, 63, 0.08);">
          <!-- Header band with logo -->
          <tr>
            <td style="background-color:${BRAND_COLORS.verde}; padding:32px 32px 28px 32px;" align="left">
              <img src="${logoUrl}" alt="Carreira USA" width="180" style="display:block; max-width:180px; width:180px; height:auto; border:0; outline:none; text-decoration:none;" />
            </td>
          </tr>
          <!-- Tangerina accent stripe -->
          <tr>
            <td style="background-color:${BRAND_COLORS.tangerina}; height:4px; line-height:4px; font-size:0;">&nbsp;</td>
          </tr>
          <!-- Title band -->
          <tr>
            <td style="background-color:${BRAND_COLORS.white}; padding:28px 32px 8px 32px;">
              <h1 style="margin:0; font-family:${FONT_STACK}; font-size:24px; font-weight:bold; color:${BRAND_COLORS.verde}; line-height:1.25;">${safeTitle}</h1>
            </td>
          </tr>
          <!-- Body container -->
          <tr>
            <td style="background-color:${BRAND_COLORS.white}; padding:8px 32px 32px 32px; font-family:${FONT_STACK}; font-size:15px; line-height:1.6; color:${BRAND_COLORS.textDark};">
              ${bodyHtml}
              ${ctaBlock}
            </td>
          </tr>
          <!-- Signature divider -->
          <tr>
            <td style="background-color:${BRAND_COLORS.white}; padding:0 32px;">
              <div style="border-top:1px solid ${BRAND_COLORS.cafeLeite}; height:0; line-height:0;">&nbsp;</div>
            </td>
          </tr>
          <!-- Signature -->
          <tr>
            <td style="background-color:${BRAND_COLORS.white}; padding:20px 32px 28px 32px; font-family:${FONT_STACK}; font-size:13px; line-height:1.55; color:${BRAND_COLORS.textMuted};">
              <div style="color:${BRAND_COLORS.verde}; font-weight:bold; font-size:14px; margin-bottom:2px;">Equipe Carreira USA</div>
              <div>Seu hub de carreira nos Estados Unidos</div>
              <div style="margin-top:10px;">
                <a href="mailto:support@carreirausa.com" style="color:${BRAND_COLORS.tangerina}; text-decoration:none; font-weight:bold;">support@carreirausa.com</a>
                &nbsp;&middot;&nbsp;
                <a href="${escapeHtml(portalUrl)}" style="color:${BRAND_COLORS.tangerina}; text-decoration:none; font-weight:bold;">Portal do cliente</a>
              </div>
              ${footerNoteBlock}
            </td>
          </tr>
        </table>
        <!-- Outer footer (copyright, unsubscribe-style note) -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; margin-top:18px;">
          <tr>
            <td align="center" style="padding:0 16px; font-family:${FONT_STACK}; font-size:11px; color:${BRAND_COLORS.textMuted}; line-height:1.5;">
              <div>&copy; ${year} Carreira USA. Todos os direitos reservados.</div>
              <div style="margin-top:4px;">Este é um e-mail transacional. Você o recebeu porque possui conta ativa no Carreira USA.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
