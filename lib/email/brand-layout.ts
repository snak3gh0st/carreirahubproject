/**
 * Carreira USA brand layout helper for transactional emails.
 *
 * Renders an email-client-safe (table-based) HTML shell using the v1.1
 * brand palette + Arial fallback font stack. Brand fonts (Blaak / Neue
 * Montreal) are NOT email-safe, so we fall back to Arial everywhere.
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

export function renderBaseLayout(opts: BaseLayoutOpts): string {
  const {
    title,
    preheader,
    bodyHtml,
    ctaLabel,
    ctaUrl,
    footerNote,
  } = opts;

  const safeTitle = escapeHtml(title);
  const safePreheader = preheader ? escapeHtml(preheader) : '';

  const preheaderBlock = preheader
    ? `<span style="display:none !important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; max-height:0; max-width:0; mso-hide:all; overflow:hidden;">${safePreheader}</span>`
    : '';

  const ctaBlock =
    ctaLabel && ctaUrl
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0 8px 0;">
          <tr>
            <td align="left" bgcolor="${BRAND_COLORS.tangerina}" style="background-color:${BRAND_COLORS.tangerina}; border-radius:6px;">
              <a href="${escapeHtml(ctaUrl)}" target="_blank" style="display:inline-block; padding:14px 28px; font-family:${FONT_STACK}; font-size:15px; font-weight:bold; color:${BRAND_COLORS.verde}; text-decoration:none; border-radius:6px;">
                ${escapeHtml(ctaLabel)}
              </a>
            </td>
          </tr>
        </table>`
      : '';

  const footerNoteBlock = footerNote
    ? `<div style="margin-top:8px;">${escapeHtml(footerNote)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0; padding:0; background-color:${BRAND_COLORS.creme}; font-family:${FONT_STACK}; color:${BRAND_COLORS.textDark};">
  ${preheaderBlock}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND_COLORS.creme}; padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%;">
          <!-- Header band -->
          <tr>
            <td style="background-color:${BRAND_COLORS.verde}; padding:24px; border-radius:8px 8px 0 0;">
              <div style="font-family:${FONT_STACK}; font-size:13px; color:${BRAND_COLORS.cafeLeite}; letter-spacing:1px; text-transform:uppercase; font-weight:bold;">Carreira USA</div>
              <div style="font-family:${FONT_STACK}; font-size:22px; color:${BRAND_COLORS.white}; font-weight:bold; margin-top:6px;">${safeTitle}</div>
            </td>
          </tr>
          <!-- Body container -->
          <tr>
            <td style="background-color:${BRAND_COLORS.white}; padding:32px 24px; border:1px solid ${BRAND_COLORS.cafeLeite}; border-top:none; border-radius:0 0 8px 8px; font-family:${FONT_STACK}; font-size:15px; line-height:1.55; color:${BRAND_COLORS.textDark};">
              ${bodyHtml}
              ${ctaBlock}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 8px 0 8px; font-family:${FONT_STACK}; font-size:12px; color:${BRAND_COLORS.textMuted}; text-align:center;">
              <div>Carreira USA &middot; Sistema interno</div>
              ${footerNoteBlock}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
