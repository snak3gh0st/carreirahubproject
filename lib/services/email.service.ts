/**
 * Email Service (Consolidated)
 *
 * Single source of truth for ALL email sending in the application.
 * Uses Resend SDK with circuit breaker protection and DB logging.
 *
 * All templates render via the shared Carreira USA brand layout
 * (see lib/email/brand-layout.ts) — Verde header, Creme background,
 * Tangerina CTA, Cafe com Leite borders, Arial fallback font stack.
 *
 * Configuration:
 * - RESEND_API_KEY: API key from resend.com
 * - EMAIL_FROM: Sender email (must be verified domain)
 */

import { Resend } from 'resend';
import { prisma } from '@/lib/db';
import { NotificationType, NotificationStatus } from '@prisma/client';
import { CircuitBreaker, CircuitOpenError } from '@/lib/utils/circuit-breaker';
import { integrationLogger, StructuredErrorData } from '@/lib/utils/logger';
import { renderBaseLayout, BRAND_COLORS } from '@/lib/email/brand-layout';
import type { CostBreakdown } from '@/lib/financial/cost-breakdown';
import type { CommercialBIResponse } from '@/lib/services/commercial-bi';

// ---------------------------------------------------------------------------
// Resend client (lazy init)
// ---------------------------------------------------------------------------

let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@carreirausa.com';
const EMAIL_FINANCE_TEAM = process.env.EMAIL_FINANCE_TEAM || 'finance@carreirausa.com';
const EMAIL_SUPPORT_TEAM = process.env.EMAIL_SUPPORT_TEAM || 'support@carreirausa.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';

// Brand-tinted semantic accents (only inside white pill backgrounds — never on Creme).
const ERROR_RED = '#A8332B';

// ---------------------------------------------------------------------------
// Exported interfaces (backward-compatible)
// ---------------------------------------------------------------------------

export interface EmailTemplate {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface OverdueInvoiceEmail {
  userName: string;
  invoices: Array<{
    invoiceNumber: string;
    customerName: string;
    amount: number;
    daysOverdue: number;
    dueDate: Date;
  }>;
}

export interface DailyDigestEmail {
  userName: string;
  summary: {
    overdueInvoices: number;
    overdueAmount: number;
    staleInvoices: number;
    staleAmount: number;
    atRiskInvoices: number;
    atRiskAmount: number;
  };
  tasks: Array<{
    type: 'collection_call' | 'follow_up' | 'escalate' | 'review';
    priority: 'high' | 'medium' | 'low';
    description: string;
    invoiceNumber?: string;
    customerName?: string;
  }>;
}

// Interfaces adopted from notification.service.ts
interface Invoice {
  id: string;
  invoiceNumber: string | null;
  amount: any;
  dueDate: Date;
  status: string;
  customer: {
    id: string;
    name: string;
    email: string;
  };
  deal?: {
    id: string;
    title: string;
  } | null;
}

interface Contract {
  id: string;
  docusign_env_id: string | null;
  status: string;
  signedUrl: string | null;
  sentAt: Date | null;
  expiresAt: Date | null;
  reminderCount: number;
  signerEmail: string;
  signerName: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
}

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

// ---------------------------------------------------------------------------
// Digest data shapes (for new internal templates — Task 3)
// ---------------------------------------------------------------------------

export interface SellerDigestData {
  date: string;
  overdueInvoices: Array<{ invoiceNumber: string; customerName: string; amount: number; daysOverdue: number }>;
  unsignedContracts: Array<{ signerName: string; dealTitle: string; daysSinceSent: number }>;
  staleDeals: Array<{ title: string; value: number; lastActivityDays: number }>;
  unansweredLeads: Array<{ name: string; source: string; hoursSinceCreated: number }>;
}

export interface FinanceDigestData {
  date: string;
  arAging: { bucket0to30: number; bucket31to60: number; bucket61to90: number; bucket90Plus: number };
  todayExpectedCollections: { count: number; amount: number };
  syncErrorInvoices: Array<{ id: string; invoiceNumber: string | null; errorMessage: string }>;
  cashflow: { revenueThisMonth: number; revenueLastMonth: number; deltaPercent: number };
  staleInvoices: { count: number; amount: number };
}

export interface AdminDailyDigestData {
  date: string;
  today: { revenueToday: number; dealsWonToday: number; leadsToday: number };
  week: { dealsWonWeek: number; leadsWeek: number };
  financial: {
    mrr: number;
    totalAR: number;
    delinquencyRate: number;
    overdueAmount: number;
    overdueCount: number;
    monthlyTrend: Array<{ label: string; revenue: number; invoiced: number; newInvoices: number; collectionRate: number }>;
    annualTrend: Array<{ label: string; revenue: number; invoiced: number; dealsWon: number; newLeads: number }>;
    arAging: Array<{ label: string; count: number; amount: number }>;
    topOverdue: Array<{ customer: string; invoiceNumber: string; amount: number; daysOverdue: number }>;
    paymentMethods: Array<{ method: string; amount: number }>;
    costBreakdown?: CostBreakdown | null;
  };
  commercial: {
    monthlyTrend: Array<{ label: string; dealsWon: number; wonValue: number; newLeads: number; qualified: number }>;
    topClosers: Array<{ name: string; won: number; value: number }>;
    leadFunnel: Array<{ status: string; count: number }>;
    leadSources: Array<{ source: string; count: number }>;
    avgQualificationScore: number;
  };
  operations: {
    activeStudents: number;
    avgNegotiationDays: number;
    monthlyEnrollments: Array<{ label: string; total: number; pass: number; advanced: number }>;
  };
}

export interface ExecutiveDailyDigestData extends AdminDailyDigestData {
  aiCfo: {
    briefing: string;
    recommendations: string[];
    generatedAt: Date | null;
    dateRange: string | null;
    isStale: boolean;
  };
  dataQuality: {
    quickBooksConnected: boolean;
    quickBooksTokenExpired: boolean;
    quickBooksTokenExpiresAt: Date | null;
    latestQuickBooksError: string | null;
  };
}

export type HeadCommercialDigestData = CommercialBIResponse;

export interface AdminDigestData {
  weekRange: string;
  mrr: { current: number; deltaWeek: number; deltaPercent: number };
  dealsAtRisk: Array<{ title: string; value: number; ownerName: string; lastActivityDays: number }>;
  cfoInsights: string;
  conversionFunnel: { leads: number; qualified: number; deals: number; won: number };
  leadSourcePerformance: Array<{ source: string; leads: number; conversions: number }>;
  biHighlights: string[];
}

export interface ContractRenewalData {
  id: string;
  signerName: string;
  signerEmail: string;
  sentAt: Date | null;
  expiresAt: Date;
  reminderCount: number;
}

export interface OpsDigestData {
  date: string;
  endingSoon: Array<{
    studentName: string;
    programType: string;
    endDate: Date;
    daysRemaining: number;
  }>;
  inactive: Array<{
    studentName: string;
    lastSessionDate: Date | null;
    daysSinceLastSession: number;
  }>;
}

// ---------------------------------------------------------------------------
// Small HTML utility helpers (private)
// ---------------------------------------------------------------------------

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtMoney(n: number): string {
  return `$${Number(n || 0).toFixed(2)}`;
}

function fmtDateBR(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function describeMethod(method: { type: 'card' | 'ach'; last4: string; brand?: string }): string {
  const brand = method.brand || (method.type === 'card' ? 'Cartão' : 'Conta bancária');
  return `${brand} ••${method.last4}`;
}

function tableRow(cells: string[]): string {
  return `<tr>${cells
    .map(
      (c) =>
        `<td style="padding:10px 12px; border-bottom:1px solid ${BRAND_COLORS.cafeLeite}; font-size:14px; color:${BRAND_COLORS.textDark};">${c}</td>`
    )
    .join('')}</tr>`;
}

function tableHead(headers: string[]): string {
  return `<thead><tr>${headers
    .map(
      (h) =>
        `<th align="left" style="padding:10px 12px; background:${BRAND_COLORS.creme}; border-bottom:2px solid ${BRAND_COLORS.cafeLeite}; font-size:13px; color:${BRAND_COLORS.verde}; text-transform:uppercase; letter-spacing:0.5px;">${esc(h)}</th>`
    )
    .join('')}</tr></thead>`;
}

function dataTable(headers: string[], rows: string[]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse; margin:16px 0; background:${BRAND_COLORS.white}; border:1px solid ${BRAND_COLORS.cafeLeite}; border-radius:6px; overflow:hidden;">${tableHead(headers)}<tbody>${rows.join('')}</tbody></table>`;
}

function tableHeadRaw(headers: string[]): string {
  return `<thead><tr>${headers
    .map(
      (h) =>
        `<th align="left" style="padding:10px 12px; background:${BRAND_COLORS.creme}; border-bottom:2px solid ${BRAND_COLORS.cafeLeite}; font-size:13px; color:${BRAND_COLORS.verde}; text-transform:uppercase; letter-spacing:0.5px;">${h}</th>`
    )
    .join('')}</tr></thead>`;
}

function dataTableRaw(headers: string[], rows: string[]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse; margin:16px 0; background:${BRAND_COLORS.white}; border:1px solid ${BRAND_COLORS.cafeLeite}; border-radius:6px; overflow:hidden;">${tableHeadRaw(headers)}<tbody>${rows.join('')}</tbody></table>`;
}

function calloutBox(content: string, tone: 'info' | 'warn' | 'error' = 'info'): string {
  const accent =
    tone === 'error' ? ERROR_RED : tone === 'warn' ? BRAND_COLORS.tangerina : BRAND_COLORS.verde;
  return `<div style="background:${BRAND_COLORS.creme}; border-left:4px solid ${accent}; padding:14px 16px; border-radius:4px; margin:16px 0; font-size:14px; color:${BRAND_COLORS.textDark};">${content}</div>`;
}

function sectionTitle(t: string): string {
  return `<h2 style="margin:24px 0 8px 0; font-size:17px; color:${BRAND_COLORS.verde}; font-weight:bold;">${esc(t)}</h2>`;
}

// ---------------------------------------------------------------------------
// EmailService class
// ---------------------------------------------------------------------------

export class EmailService {
  private circuitBreaker: CircuitBreaker;

  constructor() {
    this.circuitBreaker = new CircuitBreaker('email');
  }

  // =========================================================================
  // Core send method (circuit breaker + DB logging)
  // =========================================================================

  private async sendEmailWithTracking(
    to: string,
    subject: string,
    html: string,
    type: NotificationType,
    relations: {
      invoiceId?: string;
      contractId?: string;
      customerId?: string;
    }
  ): Promise<void> {
    try {
      const client = getResendClient();

      if (!client) {
        console.log(`[EMAIL] Resend not configured, skipping email to ${to}: ${subject}`);

        const structured: StructuredErrorData = {
          errorCode: 'CLIENT_NOT_CONFIGURED',
          category: 'auth',
          severity: 'error',
          recovery: 'check_circuit',
          metadata: { to, type },
        };

        await integrationLogger.logError(
          'email',
          'sendEmail',
          'Resend client not configured',
          structured,
          { to, type }
        );

        await this.createNotificationSafe({
          type,
          status: NotificationStatus.PENDING,
          recipient: to,
          subject,
          templateId: type,
          errorMessage: 'RESEND_API_KEY not configured',
          invoiceId: relations.invoiceId,
          contractId: relations.contractId,
          customerId: relations.customerId,
        });
        return;
      }

      const { data, error } = await this.circuitBreaker.execute(async () => {
        return await client.emails.send({
          from: EMAIL_FROM,
          to: [to],
          subject,
          html,
        });
      });

      if (error) {
        throw new Error(error.message);
      }

      await this.createNotificationSafe({
        type,
        status: NotificationStatus.SENT,
        recipient: to,
        subject,
        templateId: type,
        resendId: data?.id ?? null,
        sentAt: new Date(),
        invoiceId: relations.invoiceId,
        contractId: relations.contractId,
        customerId: relations.customerId,
      });
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        const structured: StructuredErrorData = {
          errorCode: 'CIRCUIT_OPEN',
          category: 'transient',
          severity: 'error',
          recovery: 'wait',
          metadata: { to, type },
        };

        await integrationLogger.logError('email', 'sendEmail', error, structured, { to, type });

        console.warn(`[EMAIL] Circuit breaker open for email service: ${error.message}`);

        await this.createNotificationSafe({
          type,
          status: NotificationStatus.PENDING,
          recipient: to,
          subject,
          templateId: type,
          errorMessage: `Circuit breaker open: ${error.message}. Email will be retried when service recovers.`,
          invoiceId: relations.invoiceId,
          contractId: relations.contractId,
          customerId: relations.customerId,
        });
        return;
      }

      const structured: StructuredErrorData = {
        errorCode: (error as any)?.code || 'UNKNOWN_ERROR',
        category: this.categorizeError(error),
        metadata: {
          message: (error as any)?.message,
          to,
          type,
        },
      };

      await integrationLogger.logError('email', 'sendEmail', error as any, structured, { to, type });

      console.error(`[EMAIL] Failed to send email to ${to}:`, error);

      await this.createNotificationSafe({
        type,
        status: NotificationStatus.FAILED,
        recipient: to,
        subject,
        templateId: type,
        failedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        invoiceId: relations.invoiceId,
        contractId: relations.contractId,
        customerId: relations.customerId,
      });

      throw error;
    }
  }

  // Wraps prisma.notification.create — strips customerId/invoiceId/contractId on FK violation
  // so a notification logging bug never prevents the email path from completing.
  private async createNotificationSafe(data: Parameters<typeof prisma.notification.create>[0]['data']): Promise<void> {
    try {
      await prisma.notification.create({ data });
    } catch (err: any) {
      if (err?.code === 'P2003') {
        // FK violation — retry without relation FKs so the notification is still recorded
        const { customerId, invoiceId, contractId, ...safeData } = data as any;
        try {
          await prisma.notification.create({ data: safeData });
        } catch (retryErr: any) {
          console.error('[EMAIL] Failed to create notification record (retry):', retryErr.message);
        }
      } else {
        console.error('[EMAIL] Failed to create notification record:', err.message);
      }
    }
  }

  /**
   * Lightweight send for templates with no matching NotificationType.
   * Still uses Resend SDK + circuit breaker, but skips DB notification logging.
   */
  private async sendEmailSimple(template: EmailTemplate): Promise<boolean> {
    try {
      const client = getResendClient();

      if (!client) {
        console.log(
          `[EMAIL] Resend not configured, skipping email: ${template.subject} to ${template.to}`
        );
        return false;
      }

      const recipients = Array.isArray(template.to) ? template.to : [template.to];

      const { error } = await this.circuitBreaker.execute(async () => {
        return await client.emails.send({
          from: EMAIL_FROM,
          to: recipients,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });
      });

      if (error) {
        console.error('[EMAIL] Failed to send email:', error.message);
        return false;
      }

      console.log(`[EMAIL] Email sent successfully: ${template.subject}`);
      return true;
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        console.warn(`[EMAIL] Circuit breaker open, email not sent: ${template.subject}`);
        return false;
      }
      console.error('[EMAIL] Error sending email:', error);
      return false;
    }
  }

  private categorizeError(error: any): 'transient' | 'permanent' | 'auth' | 'validation' | 'unknown' {
    const message = error?.message || '';

    if (message.includes('timeout') || message.includes('temporarily unavailable')) {
      return 'transient';
    }
    if (message.includes('unauthorized') || message.includes('authentication')) {
      return 'auth';
    }
    if (message.includes('invalid') || message.includes('malformed')) {
      return 'validation';
    }
    return 'unknown';
  }

  // =========================================================================
  // Financial templates (PT-BR, internal)
  // =========================================================================

  async sendOverdueInvoiceAlert(email: string, data: OverdueInvoiceEmail): Promise<boolean> {
    const totalAmount = data.invoices.reduce((sum, inv) => sum + inv.amount, 0);

    const rows = data.invoices.map((inv) =>
      tableRow([
        esc(inv.invoiceNumber),
        esc(inv.customerName),
        fmtMoney(inv.amount),
        esc(new Date(inv.dueDate).toLocaleDateString('pt-BR')),
        `<span style="color:${ERROR_RED}; font-weight:bold;">${inv.daysOverdue} dias</span>`,
      ])
    );

    const bodyHtml = `
      <p>Ola <strong>${esc(data.userName)}</strong>,</p>
      <p>Voce tem <strong>${data.invoices.length} fatura(s)</strong> em atraso totalizando <strong>${fmtMoney(totalAmount)}</strong>.</p>
      ${dataTable(['Fatura', 'Cliente', 'Valor', 'Vencimento', 'Dias em Atraso'], rows)}
      ${calloutBox('<strong>Acao necessaria:</strong> entre em contato com os clientes para resolver as pendencias.', 'warn')}
    `;

    const html = renderBaseLayout({
      title: 'Faturas em Atraso',
      preheader: `${data.invoices.length} fatura(s) em atraso — ${fmtMoney(totalAmount)}`,
      bodyHtml,
      ctaLabel: 'Ver faturas em atraso',
      ctaUrl: `${APP_URL}/dashboard/invoices?status=OVERDUE`,
      footerNote: 'Email automatico — nao responda.',
    });

    return this.sendEmailSimple({
      to: email,
      subject: `${data.invoices.length} Fatura(s) em Atraso — Acao Necessaria`,
      html,
    });
  }

  async sendDailyDigest(email: string, data: DailyDigestEmail): Promise<boolean> {
    const priorityLabel = { high: 'Alta', medium: 'Media', low: 'Baixa' };
    const priorityColor = {
      high: ERROR_RED,
      medium: BRAND_COLORS.tangerina,
      low: BRAND_COLORS.verde,
    } as const;

    const summaryCards = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
        <tr>
          <td width="33%" valign="top" style="padding:6px;">
            <div style="background:${BRAND_COLORS.creme}; padding:14px; border-radius:6px; border:1px solid ${BRAND_COLORS.cafeLeite};">
              <div style="font-size:12px; color:${BRAND_COLORS.textMuted}; text-transform:uppercase;">Faturas em Atraso</div>
              <div style="font-size:22px; font-weight:bold; color:${ERROR_RED};">${data.summary.overdueInvoices}</div>
              <div style="font-size:12px; color:${BRAND_COLORS.textMuted};">${fmtMoney(data.summary.overdueAmount)}</div>
            </div>
          </td>
          <td width="33%" valign="top" style="padding:6px;">
            <div style="background:${BRAND_COLORS.creme}; padding:14px; border-radius:6px; border:1px solid ${BRAND_COLORS.cafeLeite};">
              <div style="font-size:12px; color:${BRAND_COLORS.textMuted}; text-transform:uppercase;">Em Risco</div>
              <div style="font-size:22px; font-weight:bold; color:${BRAND_COLORS.tangerina};">${data.summary.atRiskInvoices}</div>
              <div style="font-size:12px; color:${BRAND_COLORS.textMuted};">${fmtMoney(data.summary.atRiskAmount)}</div>
            </div>
          </td>
          <td width="33%" valign="top" style="padding:6px;">
            <div style="background:${BRAND_COLORS.creme}; padding:14px; border-radius:6px; border:1px solid ${BRAND_COLORS.cafeLeite};">
              <div style="font-size:12px; color:${BRAND_COLORS.textMuted}; text-transform:uppercase;">Antigas</div>
              <div style="font-size:22px; font-weight:bold; color:${BRAND_COLORS.verde};">${data.summary.staleInvoices}</div>
              <div style="font-size:12px; color:${BRAND_COLORS.textMuted};">${fmtMoney(data.summary.staleAmount)}</div>
            </div>
          </td>
        </tr>
      </table>
    `;

    const tasksHtml =
      data.tasks.length > 0
        ? sectionTitle('Tarefas do Dia') +
          data.tasks
            .map(
              (task) => `
                <div style="background:${BRAND_COLORS.white}; border-left:4px solid ${priorityColor[task.priority]}; padding:12px 14px; margin:8px 0; border-radius:4px; border:1px solid ${BRAND_COLORS.cafeLeite}; border-left-width:4px;">
                  <span style="display:inline-block; padding:2px 10px; border-radius:12px; font-size:11px; font-weight:bold; color:${BRAND_COLORS.white}; background:${priorityColor[task.priority]};">${priorityLabel[task.priority]}</span>
                  <div style="margin-top:8px; font-weight:bold;">${esc(task.description)}</div>
                  ${task.customerName ? `<div style="margin-top:4px; font-size:13px; color:${BRAND_COLORS.textMuted};">Cliente: ${esc(task.customerName)}</div>` : ''}
                  ${task.invoiceNumber ? `<div style="margin-top:2px; font-size:13px; color:${BRAND_COLORS.textMuted};">Fatura: ${esc(task.invoiceNumber)}</div>` : ''}
                </div>
              `
            )
            .join('')
        : '';

    const bodyHtml = `
      <p>Ola <strong>${esc(data.userName)}</strong>,</p>
      <p>Aqui esta seu resumo diario de contas a receber:</p>
      ${summaryCards}
      ${tasksHtml}
    `;

    const html = renderBaseLayout({
      title: 'Resumo Diario - Contas a Receber',
      preheader: `Resumo diario - ${data.summary.overdueInvoices} fatura(s) em atraso`,
      bodyHtml,
      ctaLabel: 'Ver dashboard completo',
      ctaUrl: `${APP_URL}/dashboard/insights`,
      footerNote: new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    });

    return this.sendEmailSimple({
      to: email,
      subject: `Resumo Diario — ${data.summary.overdueInvoices} Fatura(s) em Atraso`,
      html,
    });
  }

  async sendStaleInvoiceAlert(
    email: string,
    userName: string,
    invoices: Array<{ invoiceNumber: string; customerName: string; amount: number; daysOverdue: number }>
  ): Promise<boolean> {
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);

    const rows = invoices.map((inv) =>
      tableRow([
        esc(inv.invoiceNumber),
        esc(inv.customerName),
        fmtMoney(inv.amount),
        `<span style="color:${ERROR_RED}; font-weight:bold;">${inv.daysOverdue} dias</span>`,
      ])
    );

    const bodyHtml = `
      <p>Ola <strong>${esc(userName)}</strong>,</p>
      <p>Voce tem <strong>${invoices.length} fatura(s)</strong> com mais de 180 dias em atraso, totalizando <strong>${fmtMoney(totalAmount)}</strong>.</p>
      ${calloutBox('<strong>Acao necessaria:</strong> revisar para write-off ou encaminhar para cobranca legal.', 'warn')}
      ${dataTable(['Fatura', 'Cliente', 'Valor', 'Dias em Atraso'], rows)}
    `;

    const html = renderBaseLayout({
      title: 'Faturas Antigas para Revisao',
      preheader: `${invoices.length} fatura(s) com 180+ dias em atraso`,
      bodyHtml,
      ctaLabel: 'Ver faturas antigas',
      ctaUrl: `${APP_URL}/dashboard/insights`,
    });

    return this.sendEmailSimple({
      to: email,
      subject: `${invoices.length} Fatura(s) Antiga(s) para Revisao (180+ dias)`,
      html,
    });
  }

  async sendWelcomeWithTempPassword(data: {
    customerName: string;
    email: string;
    tempPassword: string;
    loginUrl: string;
    locale?: string;
  }): Promise<boolean> {
    const isPt = data.locale === 'pt-BR' || data.locale === 'pt';
    const firstName = data.customerName.split(' ')[0];

    const greeting = isPt ? `Ola, ${esc(firstName)}!` : `Hi, ${esc(firstName)}!`;
    const intro = isPt
      ? 'Sua conta foi criada com sucesso. Use as credenciais abaixo para acessar seu portal e finalizar o pagamento da sua fatura.'
      : 'Your account has been created. Use the credentials below to access your portal and complete your invoice payment.';
    const accessLabel = isPt ? 'Seu acesso temporario' : 'Your temporary access';
    const emailLabel = isPt ? 'E-mail' : 'Email';
    const pwLabel = isPt ? 'Senha temporaria' : 'Temporary password';
    const note = isPt
      ? 'Voce sera solicitado(a) a criar uma senha definitiva no primeiro acesso.'
      : 'You will be asked to set a permanent password on first login.';
    const ctaLabel = isPt ? 'Acessar portal' : 'Access portal';
    const subject = isPt
      ? 'Bem-vindo(a) a Carreira USA — Acesse seu portal'
      : 'Welcome to Carreira USA — Access your portal';
    const title = isPt ? 'Bem-vindo(a) a Carreira USA' : 'Welcome to Carreira USA';

    const bodyHtml = `
      <p>${greeting}</p>
      <p>${intro}</p>
      <div style="background:${BRAND_COLORS.creme}; border:1px solid ${BRAND_COLORS.cafeLeite}; border-radius:8px; padding:18px; margin:18px 0;">
        <div style="font-size:12px; color:${BRAND_COLORS.textMuted}; text-transform:uppercase; font-weight:bold; letter-spacing:0.5px; margin-bottom:8px;">${accessLabel}</div>
        <div style="font-size:15px; margin-bottom:6px;"><strong>${emailLabel}:</strong> ${esc(data.email)}</div>
        <div style="font-size:15px;"><strong>${pwLabel}:</strong> <span style="font-family:monospace; background:${BRAND_COLORS.white}; padding:3px 8px; border-radius:4px; border:1px solid ${BRAND_COLORS.cafeLeite};">${esc(data.tempPassword)}</span></div>
      </div>
      <p style="font-size:13px; color:${BRAND_COLORS.textMuted};">${note}</p>
    `;

    const html = renderBaseLayout({
      title,
      preheader: subject,
      bodyHtml,
      ctaLabel,
      ctaUrl: data.loginUrl,
    });

    return this.sendEmailSimple({ to: data.email, subject, html });
  }

  async sendTeamMemberWelcome(data: {
    name: string;
    email: string;
    tempPassword: string;
  }): Promise<boolean> {
    const firstName = data.name.split(' ')[0];
    const loginUrl = `${APP_URL}/auth/signin`;

    const bodyHtml = `
      <p>Olá, ${esc(firstName)}!</p>
      <p>Sua conta no Carreira U.S.A. Hub foi criada. Use as credenciais abaixo para acessar o painel interno.</p>
      <div style="background:${BRAND_COLORS.creme}; border:1px solid ${BRAND_COLORS.cafeLeite}; border-radius:8px; padding:18px; margin:18px 0;">
        <div style="font-size:12px; color:${BRAND_COLORS.textMuted}; text-transform:uppercase; font-weight:bold; letter-spacing:0.5px; margin-bottom:8px;">Suas credenciais</div>
        <div style="font-size:15px; margin-bottom:6px;"><strong>E-mail:</strong> ${esc(data.email)}</div>
        <div style="font-size:15px;"><strong>Senha temporária:</strong> <span style="font-family:monospace; background:${BRAND_COLORS.white}; padding:3px 8px; border-radius:4px; border:1px solid ${BRAND_COLORS.cafeLeite};">${esc(data.tempPassword)}</span></div>
      </div>
      <p style="font-size:13px; color:${BRAND_COLORS.textMuted};">Você será solicitado(a) a criar uma senha definitiva no primeiro acesso.</p>
    `;

    const html = renderBaseLayout({
      title: 'Bem-vindo(a) ao Carreira U.S.A.',
      preheader: 'Sua conta foi criada — acesse o painel interno',
      bodyHtml,
      ctaLabel: 'Acessar painel',
      ctaUrl: loginUrl,
    });

    return this.sendEmailSimple({
      to: data.email,
      subject: 'Bem-vindo(a) ao Carreira U.S.A. — Suas credenciais de acesso',
      html,
    });
  }

  async sendInternalPasswordReset(data: {
    name?: string | null;
    email: string;
    resetUrl: string;
  }): Promise<boolean> {
    const firstName = (data.name || data.email).split(" ")[0];

    const bodyHtml = `
      <p>Olá, ${esc(firstName)}!</p>
      <p>Recebemos uma solicitação para redefinir a senha da sua conta no Carreira U.S.A. Hub.</p>
      <p>Clique no botão abaixo para criar uma nova senha:</p>
      ${calloutBox('<strong>Este link expira em 1 hora.</strong> Se você não solicitou essa alteração, pode ignorar este e-mail com segurança.', 'warn')}
      <div style="background:${BRAND_COLORS.creme}; border:1px solid ${BRAND_COLORS.cafeLeite}; border-radius:8px; padding:18px; margin:18px 0;">
        <div style="font-size:12px; color:${BRAND_COLORS.textMuted}; text-transform:uppercase; font-weight:bold; letter-spacing:0.5px; margin-bottom:8px;">Acesso seguro</div>
        <div style="font-size:15px; margin-bottom:6px;"><strong>E-mail:</strong> ${esc(data.email)}</div>
        <div style="font-size:13px; color:${BRAND_COLORS.textMuted};">Por segurança, nunca compartilhe este link nem sua nova senha.</div>
      </div>
    `;

    const html = renderBaseLayout({
      title: 'Redefina sua senha',
      preheader: 'Link seguro para redefinir sua senha',
      bodyHtml,
      ctaLabel: 'Redefinir senha',
      ctaUrl: data.resetUrl,
      footerNote: 'Se precisar de ajuda, fale com o administrador do sistema.',
    });

    return this.sendEmailSimple({
      to: data.email,
      subject: 'Redefina sua senha — Carreira U.S.A.',
      html,
    });
  }

  // =========================================================================
  // Contract templates
  // =========================================================================

  async sendContractForSignature(contract: Contract, customer: Customer, invoiceNumber: string): Promise<void> {
    const subject = `CarreiraUSA — Contract Ready for Signature`;
    const html = this.generateContractSignatureRequestEmail(contract, customer, invoiceNumber);

    await this.sendEmailWithTracking(
      customer.email,
      subject,
      html,
      NotificationType.CONTRACT_SENT,
      { contractId: contract.id, customerId: customer.id }
    );
  }

  async sendContractSigned(contract: Contract, customer: Customer): Promise<void> {
    const subject = `Contrato assinado — ${customer.name}`;
    const html = this.generateContractSignedEmail(contract, customer);

    await this.sendEmailWithTracking(
      EMAIL_FINANCE_TEAM,
      subject,
      html,
      NotificationType.CONTRACT_SIGNED,
      { contractId: contract.id, customerId: customer.id }
    );
  }

  async sendContractExpired(contract: Contract, customer: Customer): Promise<void> {
    const subject = `Contrato expirado — ${customer.name}`;
    const html = this.generateContractExpiredEmail(contract, customer);

    await this.sendEmailWithTracking(
      EMAIL_FINANCE_TEAM,
      subject,
      html,
      NotificationType.CONTRACT_EXPIRED,
      { contractId: contract.id, customerId: customer.id }
    );
  }

  // =========================================================================
  // Payment templates
  // =========================================================================

  async sendPaymentLink(invoice: Invoice, customer: Customer, paymentUrl: string): Promise<void> {
    const subject = `CarreiraUSA — Payment for Invoice ${invoice.invoiceNumber || invoice.id}`;
    const html = this.generatePaymentLinkEmail(invoice, customer, paymentUrl);

    await this.sendEmailWithTracking(
      customer.email,
      subject,
      html,
      NotificationType.PAYMENT_LINK_SENT,
      { invoiceId: invoice.id, customerId: customer.id }
    );
  }

  async sendPaymentReminder(invoice: Invoice, customer: Customer, paymentUrl: string): Promise<void> {
    const daysUntilDue = Math.ceil((invoice.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const subject = `Payment Reminder — Invoice ${invoice.invoiceNumber || invoice.id} due in ${daysUntilDue} days`;
    const html = this.generatePaymentReminderEmail(invoice, customer, paymentUrl, daysUntilDue);

    await this.sendEmailWithTracking(
      customer.email,
      subject,
      html,
      NotificationType.PAYMENT_REMINDER,
      { invoiceId: invoice.id, customerId: customer.id }
    );
  }

  async sendStaleInvoiceReminder(
    invoice: Invoice,
    customer: Customer,
    paymentUrl: string,
    daysSinceSent: number
  ): Promise<void> {
    const urgent = daysSinceSent >= 60;
    const subject = `Payment reminder — Invoice ${invoice.invoiceNumber || invoice.id} — ${daysSinceSent} days pending`;

    const bodyHtml = `
      <p>Dear ${esc(customer.name)},</p>
      <p>Your invoice has been pending for <strong>${daysSinceSent} day(s)</strong>. Please process the payment at your earliest convenience.</p>
      ${calloutBox(
        `<h4 style="margin:0 0 8px 0; color:${BRAND_COLORS.verde};">Invoice pending for ${daysSinceSent} day(s)</h4>
         <p style="margin:4px 0;"><strong>Invoice:</strong> ${esc(invoice.invoiceNumber || invoice.id)}</p>
         <p style="margin:4px 0;"><strong>Amount:</strong> ${fmtMoney(Number(invoice.amount))}</p>
         <p style="margin:4px 0;"><strong>Due date:</strong> ${esc(new Date(invoice.dueDate).toLocaleDateString('en-US'))}</p>`,
        urgent ? 'error' : 'warn'
      )}
      <p>If you have already made the payment, please disregard this message.</p>
    `;

    await this.sendEmailWithTracking(
      customer.email,
      subject,
      renderBaseLayout({
        title: 'Payment reminder',
        preheader: `Invoice ${esc(invoice.invoiceNumber || invoice.id)} — ${fmtMoney(Number(invoice.amount))} — ${daysSinceSent}d pending`,
        bodyHtml,
        ctaLabel: 'Pay now',
        ctaUrl: paymentUrl,
      }),
      NotificationType.PAYMENT_REMINDER,
      { invoiceId: invoice.id, customerId: customer.id }
    );
  }

  async sendPaymentReceived(invoice: Invoice, customer: Customer): Promise<void> {
    const subject = `Payment Received — Invoice ${invoice.invoiceNumber || invoice.id}`;
    const html = this.generatePaymentReceivedEmail(invoice, customer);

    await this.sendEmailWithTracking(
      customer.email,
      subject,
      html,
      NotificationType.PAYMENT_RECEIVED,
      { invoiceId: invoice.id, customerId: customer.id }
    );

    await this.sendEmailWithTracking(
      EMAIL_FINANCE_TEAM,
      subject,
      html,
      NotificationType.PAYMENT_RECEIVED,
      { invoiceId: invoice.id, customerId: customer.id }
    );
  }

  // =========================================================================
  // Hub templates (customer-facing)
  // =========================================================================

  async sendHubWelcome(customer: { id: string; email: string; name: string }, tempPassword: string): Promise<void> {
    const subject = `Welcome to Carreira U.S.A. — Your account is ready`;
    const html = this.generateHubWelcomeEmail(customer, tempPassword);

    await this.sendEmailWithTracking(
      customer.email,
      subject,
      html,
      NotificationType.HUB_WELCOME,
      { customerId: customer.id }
    );
  }

  async sendHubAccessInvite(
    customer: { id: string; email: string; name: string; preferredLanguage?: string | null },
    setupUrl: string
  ): Promise<void> {
    const isPt = customer.preferredLanguage === "pt-BR";
    const subject = isPt
      ? "Seu portal Carreira U.S.A. esta pronto"
      : "Your Carreira U.S.A. portal is ready";
    const html = this.generateHubAccessInviteEmail(customer, setupUrl);

    await this.sendEmailWithTracking(
      customer.email,
      subject,
      html,
      NotificationType.HUB_WELCOME,
      { customerId: customer.id }
    );
  }

  async sendHubInvoiceAvailable(
    customer: { id: string; email: string; name: string },
    invoice: { id: string; invoiceNumber: string | null; amount: any }
  ): Promise<void> {
    const subject = `New invoice available — Carreira U.S.A.`;
    const html = this.generateHubInvoiceAvailableEmail(customer, invoice);

    await this.sendEmailWithTracking(
      customer.email,
      subject,
      html,
      NotificationType.HUB_INVOICE_AVAILABLE,
      { customerId: customer.id, invoiceId: invoice.id }
    );
  }

  async sendHubPasswordReset(customer: { id: string; email: string; name: string }, resetUrl: string): Promise<void> {
    const subject = `Password Reset — Carreira U.S.A.`;
    const html = this.generateHubPasswordResetEmail(customer, resetUrl);

    await this.sendEmailWithTracking(
      customer.email,
      subject,
      html,
      NotificationType.HUB_PASSWORD_RESET,
      { customerId: customer.id }
    );
  }

  // =========================================================================
  // Autopay (customer-facing) — covers new-invoice + scheduled autopay charge,
  // successful autopay receipt, and autopay failure notifications.
  // Uses existing NotificationType enum values to avoid a schema migration.
  // =========================================================================

  /**
   * Sent when a new invoice is created for a customer whose payment method
   * is already on file in QuickBooks Payments. Covers both "nova invoice"
   * and "fatura chegando" — the customer sees the amount, due date, and
   * the method that will be charged automatically.
   */
  async sendHubAutopayScheduled(
    customer: { id: string; email: string; name: string },
    invoice: { id: string; invoiceNumber: string | null; amount: any; dueDate: Date },
    method: { type: 'card' | 'ach'; last4: string; brand?: string }
  ): Promise<void> {
    const invNum = invoice.invoiceNumber || invoice.id.slice(0, 8);
    const subject = `Nova fatura #${invNum} — cobrança automática em ${fmtDateBR(invoice.dueDate)}`;
    const html = this.generateHubAutopayScheduledEmail(customer, invoice, method);

    await this.sendEmailWithTracking(
      customer.email,
      subject,
      html,
      NotificationType.HUB_INVOICE_AVAILABLE,
      { customerId: customer.id, invoiceId: invoice.id }
    );
  }

  /** Sent after the auto-charge cron successfully charges a saved method. */
  async sendHubAutopayReceipt(
    customer: { id: string; email: string; name: string },
    invoice: { id: string; invoiceNumber: string | null; amount: any },
    method: { type: 'card' | 'ach'; last4: string; brand?: string }
  ): Promise<void> {
    const invNum = invoice.invoiceNumber || invoice.id.slice(0, 8);
    const subject = `Pagamento automático processado — Fatura #${invNum}`;
    const html = this.generateHubAutopayReceiptEmail(customer, invoice, method);

    await this.sendEmailWithTracking(
      customer.email,
      subject,
      html,
      NotificationType.PAYMENT_RECEIVED,
      { customerId: customer.id, invoiceId: invoice.id }
    );
  }

  /** Sent after an autopay attempt fails. Informs retry schedule or manual-pay link if exhausted. */
  async sendHubAutopayFailed(
    customer: { id: string; email: string; name: string },
    invoice: { id: string; invoiceNumber: string | null; amount: any; dueDate: Date },
    method: { type: 'card' | 'ach'; last4: string; brand?: string },
    nextRetry: Date | null,
    isFinalAttempt: boolean
  ): Promise<void> {
    const invNum = invoice.invoiceNumber || invoice.id.slice(0, 8);
    const subject = isFinalAttempt
      ? `Não foi possível cobrar automaticamente — Fatura #${invNum}`
      : `Tentativa de cobrança falhou — Fatura #${invNum}`;
    const html = this.generateHubAutopayFailedEmail(
      customer, invoice, method, nextRetry, isFinalAttempt
    );

    await this.sendEmailWithTracking(
      customer.email,
      subject,
      html,
      NotificationType.PAYMENT_REMINDER,
      { customerId: customer.id, invoiceId: invoice.id }
    );
  }

  // =========================================================================
  // Deprecated approval stubs (preserved for backward compat)
  // =========================================================================

  /** @deprecated Invoice approval workflow removed in quick-012 */
  async sendInvoiceApprovalRequest(invoice: Invoice, submitter: User): Promise<void> {
    console.warn('sendInvoiceApprovalRequest called but approval workflow has been removed');
  }

  /** @deprecated Invoice approval workflow removed in quick-012 */
  async sendInvoiceApproved(invoice: Invoice, approver: User): Promise<void> {
    console.warn('sendInvoiceApproved called but approval workflow has been removed');
  }

  /** @deprecated Invoice approval workflow removed in quick-012 */
  async sendInvoiceRejected(invoice: Invoice, rejector: User, reason: string): Promise<void> {
    console.warn('sendInvoiceRejected called but approval workflow has been removed');
  }

  // =========================================================================
  // Commercial notification (legacy — preserved)
  // =========================================================================

  async notifyCommercialUser(
    deal: { id: string; title: string; ownerId: string | null; customer: { name: string; email: string } },
    contract: { id: string; status: string }
  ): Promise<void> {
    try {
      if (!deal.ownerId) {
        console.log(`[EMAIL] Deal ${deal.id} has no owner, cannot notify`);
        return;
      }

      const owner = await prisma.user.findUnique({
        where: { id: deal.ownerId }
      });

      if (!owner || !owner.email) {
        console.log(`[EMAIL] Deal owner ${deal.ownerId} not found or has no email`);
        return;
      }

      const recentNotification = await prisma.notification.findFirst({
        where: {
          contractId: contract.id,
          type: NotificationType.CONTRACT_SIGNED,
          createdAt: { gte: new Date(Date.now() - 60000) }
        }
      });

      if (recentNotification) {
        console.log(`[EMAIL] Contract ${contract.id} notification already sent`);
        return;
      }

      const notification = await prisma.notification.create({
        data: {
          type: NotificationType.CONTRACT_SIGNED,
          status: NotificationStatus.PENDING,
          recipient: owner.email,
          subject: `Contract Signed: ${deal.customer.name}`,
          templateId: NotificationType.CONTRACT_SIGNED,
          contractId: contract.id,
        }
      });

      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date()
        }
      });

      console.log(`[EMAIL] Created notification ${notification.id} for ${owner.email}`);

      const structured = {
        errorCode: 'SUCCESS',
        category: 'transient' as const,
        metadata: {
          dealId: deal.id,
          contractId: contract.id,
          ownerId: owner.id,
          ownerEmail: owner.email
        }
      };

      await integrationLogger.logSuccess('notification', 'COMMERCIAL_NOTIFIED', structured);

    } catch (error) {
      console.error('[EMAIL] Failed to notify commercial user:', error);

      const structured = {
        errorCode: 'NOTIFICATION_FAILED',
        category: 'unknown' as const,
        metadata: {
          dealId: deal.id,
          contractId: contract.id
        }
      };

      await integrationLogger.logError(
        'notification',
        'COMMERCIAL_NOTIFICATION_FAILED',
        error as Error,
        structured,
        { dealId: deal.id, contractId: contract.id }
      );
    }
  }

  // =========================================================================
  // NEW (Task 3): Seller real-time + 3 digests — PT-BR
  // =========================================================================

  async sendSellerInvoiceOverdue(invoice: Invoice, seller: User): Promise<void> {
    const customerName = invoice.customer?.name || 'cliente';
    const invNum = invoice.invoiceNumber || invoice.id;
    const daysOverdue = Math.max(0, Math.ceil((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)));
    const amount = Number(invoice.amount || 0);
    const subject = `[Cobranca] Fatura ${invNum} de ${customerName} venceu`;

    const bodyHtml = `
      <p>Ola <strong>${esc(seller.name || 'vendedor(a)')}</strong>,</p>
      <p>A fatura abaixo entrou em atraso e precisa de acao:</p>
      ${dataTable(
        ['Fatura', 'Cliente', 'Valor', 'Dias em atraso'],
        [tableRow([esc(invNum), esc(customerName), fmtMoney(amount), `<span style="color:${ERROR_RED}; font-weight:bold;">${daysOverdue}</span>`])]
      )}
      ${calloutBox('Entre em contato com o cliente para regularizar o pagamento.', 'warn')}
    `;

    const html = renderBaseLayout({
      title: 'Fatura em atraso',
      preheader: `${invNum} — ${customerName} (${daysOverdue} dias em atraso)`,
      bodyHtml,
      ctaLabel: 'Ver fatura',
      ctaUrl: `${APP_URL}/dashboard/invoices/${invoice.id}`,
    });

    await this.sendEmailWithTracking(
      seller.email,
      subject,
      html,
      NotificationType.INVOICE_OVERDUE_SELLER,
      { invoiceId: invoice.id, customerId: invoice.customer?.id }
    );
  }

  async sendSellerInvoicePaid(invoice: Invoice, seller: User): Promise<void> {
    const customerName = invoice.customer?.name || 'cliente';
    const invNum = invoice.invoiceNumber || invoice.id;
    const amount = Number(invoice.amount || 0);
    const subject = `Pagamento recebido — ${customerName} (${fmtMoney(amount)})`;

    const bodyHtml = `
      <p>Ola <strong>${esc(seller.name || 'vendedor(a)')}</strong>,</p>
      <p>Boas noticias — o pagamento da fatura foi confirmado.</p>
      ${dataTable(
        ['Fatura', 'Cliente', 'Valor'],
        [tableRow([esc(invNum), esc(customerName), `<strong>${fmtMoney(amount)}</strong>`])]
      )}
      ${calloutBox('Aproveite para parabenizar o cliente e seguir com os proximos passos.', 'info')}
    `;

    const html = renderBaseLayout({
      title: 'Pagamento recebido',
      preheader: `${customerName} pagou ${fmtMoney(amount)}`,
      bodyHtml,
      ctaLabel: 'Ver fatura',
      ctaUrl: `${APP_URL}/dashboard/invoices/${invoice.id}`,
    });

    await this.sendEmailWithTracking(
      seller.email,
      subject,
      html,
      NotificationType.INVOICE_PAID_SELLER,
      { invoiceId: invoice.id, customerId: invoice.customer?.id }
    );
  }

  async sendSellerContractSigned(contract: Contract, seller: User, dealTitle?: string): Promise<void> {
    const subject = `Contrato assinado — ${contract.signerName}`;
    const ctaUrl = contract.signedUrl || `${APP_URL}/dashboard/contracts/${contract.id}`;

    const bodyHtml = `
      <p>Ola <strong>${esc(seller.name || 'vendedor(a)')}</strong>,</p>
      <p>O contrato foi assinado pelo cliente.</p>
      <ul style="margin:12px 0; padding-left:20px;">
        <li><strong>Assinante:</strong> ${esc(contract.signerName)} (${esc(contract.signerEmail)})</li>
        ${dealTitle ? `<li><strong>Negociacao:</strong> ${esc(dealTitle)}</li>` : ''}
        <li><strong>Assinado em:</strong> ${esc(new Date().toLocaleString('pt-BR'))}</li>
      </ul>
      ${calloutBox('O fluxo de cobranca seguira automaticamente. Avise o cliente caso precise de proximos passos manuais.', 'info')}
    `;

    const html = renderBaseLayout({
      title: 'Contrato assinado',
      preheader: `${contract.signerName} assinou o contrato`,
      bodyHtml,
      ctaLabel: 'Abrir contrato',
      ctaUrl,
    });

    await this.sendEmailWithTracking(
      seller.email,
      subject,
      html,
      NotificationType.CONTRACT_SIGNED_SELLER,
      { contractId: contract.id }
    );
  }

  async sendSellerContractUnsigned(
    contract: Contract,
    seller: User,
    reason: 'expired' | 'declined' | 'voided'
  ): Promise<void> {
    const reasonPt =
      reason === 'expired' ? 'expirou' : reason === 'declined' ? 'foi recusado' : 'foi cancelado';
    const subject = `Contrato ${reasonPt} — ${contract.signerName}`;

    const bodyHtml = `
      <p>Ola <strong>${esc(seller.name || 'vendedor(a)')}</strong>,</p>
      <p>O contrato com <strong>${esc(contract.signerName)}</strong> ${esc(reasonPt)}.</p>
      <ul style="margin:12px 0; padding-left:20px;">
        <li><strong>Email:</strong> ${esc(contract.signerEmail)}</li>
        ${contract.sentAt ? `<li><strong>Enviado em:</strong> ${esc(new Date(contract.sentAt).toLocaleDateString('pt-BR'))}</li>` : ''}
        ${contract.expiresAt ? `<li><strong>Expira em:</strong> ${esc(new Date(contract.expiresAt).toLocaleDateString('pt-BR'))}</li>` : ''}
        <li><strong>Lembretes enviados:</strong> ${contract.reminderCount}</li>
      </ul>
      ${calloutBox('<strong>Acao sugerida:</strong> reenvie o contrato ou ligue para o cliente.', 'warn')}
    `;

    const html = renderBaseLayout({
      title: `Contrato ${reasonPt}`,
      preheader: `Contrato com ${contract.signerName} ${reasonPt}`,
      bodyHtml,
      ctaLabel: 'Ver contrato',
      ctaUrl: `${APP_URL}/dashboard/contracts/${contract.id}`,
    });

    await this.sendEmailWithTracking(
      seller.email,
      subject,
      html,
      NotificationType.CONTRACT_UNSIGNED_SELLER,
      { contractId: contract.id }
    );
  }

  async sendContractRenewalWarning(
    contract: ContractRenewalData,
    seller: { name: string | null; email: string },
    daysUntilExpiry: number
  ): Promise<void> {
    const urgency: 'warn' | 'error' = daysUntilExpiry <= 7 ? 'error' : 'warn';
    const subject = `Contrato expira em ${daysUntilExpiry} dia(s) — ${esc(contract.signerName)}`;

    const bodyHtml = `
    <p>Olá ${esc(seller.name || 'vendedor')},</p>
    <p>O contrato abaixo expira em <strong>${daysUntilExpiry} dia(s)</strong>. Reenvie ou entre em contato com o cliente para evitar que expire sem assinatura.</p>
    ${calloutBox(
      `<h4 style="margin:0 0 8px 0; color:${BRAND_COLORS.verde};">Expira em ${daysUntilExpiry} dia(s)</h4>
       <p style="margin:4px 0;"><strong>Assinante:</strong> ${esc(contract.signerName)}</p>
       <p style="margin:4px 0;"><strong>E-mail:</strong> ${esc(contract.signerEmail)}</p>
       <p style="margin:4px 0;"><strong>Enviado em:</strong> ${fmtDateBR(contract.sentAt)}</p>
       <p style="margin:4px 0;"><strong>Expira em:</strong> ${fmtDateBR(contract.expiresAt)}</p>
       <p style="margin:4px 0;"><strong>Lembretes enviados:</strong> ${contract.reminderCount}</p>`,
      urgency
    )}
    <p>Reenvie o contrato pelo painel ou ligue para o cliente.</p>
  `;

    await this.sendEmailWithTracking(
      seller.email,
      subject,
      renderBaseLayout({
        title: `Contrato expira em ${daysUntilExpiry} dia(s)`,
        preheader: `Ação necessária — ${esc(contract.signerName)} ainda não assinou`,
        bodyHtml,
        ctaLabel: 'Ver contrato',
        ctaUrl: `${APP_URL}/dashboard/contracts/${contract.id}`,
      }),
      NotificationType.CONTRACT_RENEWAL_WARNING,
      { contractId: contract.id }
    );
  }

  async sendOpsDailyDigest(
    coordinator: { name: string | null; email: string },
    data: OpsDigestData
  ): Promise<void> {
    const endingSoonRows = data.endingSoon.map((s) =>
      tableRow([
        esc(s.studentName),
        esc(s.programType),
        fmtDateBR(s.endDate),
        `${s.daysRemaining}d`,
      ])
    );

    const inactiveRows = data.inactive.map((s) =>
      tableRow([
        esc(s.studentName),
        s.lastSessionDate ? fmtDateBR(s.lastSessionDate) : 'Nenhuma sessão',
        `${s.daysSinceLastSession}d`,
      ])
    );

    const endingSoonSection =
      data.endingSoon.length > 0
        ? `${sectionTitle('Matrículas encerrando em breve')}${dataTable(
            ['Aluno', 'Programa', 'Encerramento', 'Dias restantes'],
            endingSoonRows
          )}`
        : '';

    const inactiveSection =
      data.inactive.length > 0
        ? `${sectionTitle('Alunos sem sessão há 14+ dias')}${dataTable(
            ['Aluno', 'Última sessão', 'Dias sem sessão'],
            inactiveRows
          )}`
        : '';

    const bodyHtml = `
    <p>Olá ${esc(coordinator.name || 'coordenador')},</p>
    <p>Seu resumo de alunos que precisam de atenção hoje.</p>
    ${endingSoonSection}
    ${inactiveSection}
  `;

    const totalCount = data.endingSoon.length + data.inactive.length;

    await this.sendEmailSimple({
      to: coordinator.email,
      subject: `Ops — ${totalCount} aluno(s) precisam de atenção — ${data.date}`,
      html: renderBaseLayout({
        title: `Ops — ${totalCount} aluno(s) hoje`,
        preheader: `${data.endingSoon.length} encerrando em breve · ${data.inactive.length} sem sessão`,
        bodyHtml,
        ctaLabel: 'Ver alunos',
        ctaUrl: `${APP_URL}/ops`,
      }),
    });
  }

  async sendHubFormReminder(
    customer: { id: string; email: string; name: string },
    templateId: string,
    assignedAt: Date,
    daysPending: number,
    language: string
  ): Promise<void> {
    const isPtBr = language === 'pt-BR';
    const firstName = esc(customer.name.split(' ')[0]);
    const portalUrl = `${APP_URL}/hub/login`;

    const subject = isPtBr
      ? `Lembrete: seu formulário está aguardando`
      : `Reminder: your form is waiting`;

    const bodyHtml = isPtBr
      ? `
        <p>Olá ${firstName},</p>
        <p>Você tem um formulário atribuído há <strong>${daysPending} dia(s)</strong> que ainda não foi preenchido.</p>
        ${calloutBox(
          `<p style="margin:0;"><strong>Formulário:</strong> ${esc(templateId)}</p>
           <p style="margin:4px 0 0 0;"><strong>Atribuído em:</strong> ${fmtDateBR(assignedAt)}</p>`,
          'warn'
        )}
        <p>Acesse o portal para preencher seu formulário.</p>
      `
      : `
        <p>Hi ${firstName},</p>
        <p>You have a form assigned <strong>${daysPending} day(s) ago</strong> that hasn't been completed yet.</p>
        ${calloutBox(
          `<p style="margin:0;"><strong>Form:</strong> ${esc(templateId)}</p>
           <p style="margin:4px 0 0 0;"><strong>Assigned:</strong> ${esc(new Date(assignedAt).toLocaleDateString('en-US'))}</p>`,
          'warn'
        )}
        <p>Please log in to complete your form.</p>
      `;

    await this.sendEmailWithTracking(
      customer.email,
      subject,
      renderBaseLayout({
        title: isPtBr ? 'Formulário pendente' : 'Pending form',
        preheader: isPtBr
          ? `${esc(templateId)} — pendente há ${daysPending} dia(s)`
          : `${esc(templateId)} — pending for ${daysPending} day(s)`,
        bodyHtml,
        ctaLabel: isPtBr ? 'Acessar portal' : 'Go to portal',
        ctaUrl: portalUrl,
      }),
      NotificationType.HUB_FORM_REMINDER,
      { customerId: customer.id }
    );
  }

  async sendSellerDailyDigest(seller: User, data: SellerDigestData): Promise<void> {
    const allEmpty =
      data.overdueInvoices.length === 0 &&
      data.unsignedContracts.length === 0 &&
      data.staleDeals.length === 0 &&
      data.unansweredLeads.length === 0;

    if (allEmpty) {
      console.log(`[EMAIL] Skipping seller digest for ${seller.email} — no items`);
      return;
    }

    const sections: string[] = [];

    if (data.overdueInvoices.length > 0) {
      const rows = data.overdueInvoices.map((i) =>
        tableRow([
          esc(i.invoiceNumber),
          esc(i.customerName),
          fmtMoney(i.amount),
          `<span style="color:${ERROR_RED}; font-weight:bold;">${i.daysOverdue} dias</span>`,
        ])
      );
      sections.push(sectionTitle('Faturas em atraso') + dataTable(['Fatura', 'Cliente', 'Valor', 'Atraso'], rows));
    }

    if (data.unsignedContracts.length > 0) {
      const rows = data.unsignedContracts.map((c) =>
        tableRow([esc(c.signerName), esc(c.dealTitle), `${c.daysSinceSent} dias`])
      );
      sections.push(sectionTitle('Contratos pendentes de assinatura (7+ dias)') + dataTable(['Assinante', 'Negociacao', 'Enviado ha'], rows));
    }

    if (data.staleDeals.length > 0) {
      const rows = data.staleDeals.map((d) =>
        tableRow([esc(d.title), fmtMoney(d.value), `${d.lastActivityDays} dias`])
      );
      sections.push(sectionTitle('Negocios sem atividade (14+ dias)') + dataTable(['Negocio', 'Valor', 'Sem atividade'], rows));
    }

    if (data.unansweredLeads.length > 0) {
      const rows = data.unansweredLeads.map((l) =>
        tableRow([esc(l.name), esc(l.source), `${l.hoursSinceCreated}h`])
      );
      sections.push(sectionTitle('Leads sem resposta (24h+)') + dataTable(['Lead', 'Origem', 'Tempo'], rows));
    }

    const subject = `Seu resumo do dia — ${data.date}`;
    const bodyHtml = `
      <p>Ola <strong>${esc(seller.name || 'vendedor(a)')}</strong>,</p>
      <p>Resumo das suas pendencias para hoje:</p>
      ${sections.join('')}
    `;

    const html = renderBaseLayout({
      title: 'Resumo diario do vendedor',
      preheader: `Resumo ${data.date} — pendencias do dia`,
      bodyHtml,
      ctaLabel: 'Abrir dashboard',
      ctaUrl: `${APP_URL}/dashboard`,
      footerNote: data.date,
    });

    await this.sendEmailWithTracking(
      seller.email,
      subject,
      html,
      NotificationType.SELLER_DAILY_DIGEST,
      {}
    );
  }

  async sendHeadCommercialDailyDigest(
    user: { name?: string | null; email: string },
    data: HeadCommercialDigestData
  ): Promise<void> {
    const subject = `BI Comercial diario — ${fmtDateBR(data.dateRange.to)}`;
    const $$ = (n: number) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    const pct = (n: number) => `${Number(n || 0).toFixed(1)}%`;
    const pendingTotal =
      data.summary.pendingContracts +
      data.summary.pendingInvoices +
      data.summary.staleOpenDeals +
      data.summary.unassignedOpenDeals;

    const summaryStrip = `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
        <tr>
          ${[
            { label: 'Pipeline aberto', val: $$(data.summary.openPipelineValue), color: BRAND_COLORS.textDark },
            { label: 'Fechado', val: $$(data.summary.wonValue), color: BRAND_COLORS.verde },
            { label: 'Conversao', val: pct(data.summary.conversionRate), color: BRAND_COLORS.verde },
            { label: 'Pendencias', val: String(pendingTotal), color: pendingTotal > 0 ? ERROR_RED : BRAND_COLORS.verde },
          ].map(({ label, val, color }) => `
            <td width="25%" style="padding:0 6px 0 0;">
              <div style="background:${BRAND_COLORS.creme};border:1px solid ${BRAND_COLORS.cafeLeite};border-radius:6px;padding:10px;text-align:center;">
                <div style="font-size:11px;color:${BRAND_COLORS.textMuted};margin-bottom:4px;">${label}</div>
                <div style="font-size:18px;font-weight:bold;color:${color};">${val}</div>
              </div>
            </td>
          `).join('')}
        </tr>
      </table>`;

    const sellersBlock = data.sellers.length > 0 ? `
      ${sectionTitle('Performance por vendedor')}
      ${dataTable(
        ['Vendedor', 'Leads', 'Pipeline', 'Fechado', 'Conversao', 'Pendencias', 'Clint'],
        data.sellers.map((seller) => {
          const sellerPending = seller.pendingContracts + seller.pendingInvoices + seller.staleOpenDeals;
          return tableRow([
            `<strong>${esc(seller.sellerName)}</strong><br><span style="font-size:12px;color:${BRAND_COLORS.textMuted};">${esc(seller.sellerEmail)}</span>`,
            `${seller.leads} <span style="font-size:11px;color:${BRAND_COLORS.textMuted};">(${seller.qualifiedLeads} qual.)</span>`,
            $$(seller.openPipelineValue),
            `<strong>${$$(seller.wonValue)}</strong>`,
            pct(seller.conversionRate),
            `<span style="color:${sellerPending > 0 ? ERROR_RED : BRAND_COLORS.verde};font-weight:bold;">${sellerPending}</span><br><span style="font-size:11px;color:${BRAND_COLORS.textMuted};">${$$(seller.pendingInvoiceAmount)}</span>`,
            String(seller.clintLinkedDeals),
          ]);
        })
      )}` : calloutBox('Nenhum vendedor ativo encontrado no BI Comercial.', 'warn');

    const sourceBlock = data.sourceBreakdown.length > 0 ? `
      ${sectionTitle('Origem dos leads')}
      ${dataTable(
        ['Origem', 'Leads', 'Qualificados', 'Convertidos', 'Score medio'],
        data.sourceBreakdown.slice(0, 8).map((source) =>
          tableRow([
            esc(source.source),
            String(source.leads),
            String(source.qualified),
            String(source.converted),
            source.avgScore == null ? '-' : String(source.avgScore),
          ])
        )
      )}` : '';

    const staleDealsBlock = data.actionQueue.staleDeals.length > 0 ? `
      ${sectionTitle('Negocios parados')}
      ${dataTable(
        ['Negocio', 'Vendedor', 'Valor', 'Parado ha'],
        data.actionQueue.staleDeals.slice(0, 5).map((deal) =>
          tableRow([esc(deal.title), esc(deal.sellerName), $$(deal.value), `${deal.daysStale} dias`])
        )
      )}` : '';

    const pendingInvoicesBlock = data.actionQueue.pendingInvoices.length > 0 ? `
      ${sectionTitle('Invoices pendentes')}
      ${dataTable(
        ['Invoice', 'Vendedor', 'Aberto', 'Atraso'],
        data.actionQueue.pendingInvoices.slice(0, 5).map((invoice) =>
          tableRow([
            esc(invoice.invoiceNumber),
            esc(invoice.sellerName),
            `<strong>${$$(invoice.openAmount)}</strong>`,
            invoice.daysOverdue == null ? '-' : `<span style="color:${ERROR_RED};font-weight:bold;">${invoice.daysOverdue} dias</span>`,
          ])
        )
      )}` : '';

    const missingProcessBlock =
      data.actionQueue.wonWithoutContract.length > 0 || data.actionQueue.wonWithoutInvoice.length > 0
        ? `
          ${sectionTitle('Fechados sem proximo passo')}
          ${dataTable(
            ['Tipo', 'Negocio', 'Vendedor', 'Valor'],
            [
              ...data.actionQueue.wonWithoutContract.slice(0, 5).map((deal) =>
                tableRow(['Sem contrato', esc(deal.title), esc(deal.sellerName), $$(deal.value)])
              ),
              ...data.actionQueue.wonWithoutInvoice.slice(0, 5).map((deal) =>
                tableRow(['Sem invoice', esc(deal.title), esc(deal.sellerName), $$(deal.value)])
              ),
            ]
          )}`
        : '';

    const bodyHtml = `
      <p style="margin:0 0 16px;">Ola <strong>${esc(user.name || 'Head Comercial')}</strong>, segue o resumo comercial do time para <strong>${fmtDateBR(data.dateRange.to)}</strong>.</p>
      ${summaryStrip}
      ${calloutBox(
        `<strong>${esc(data.freshness.summary)}</strong><br>
         <span style="font-size:12px;color:${BRAND_COLORS.textMuted};">Periodo: ${fmtDateBR(data.dateRange.from)} ate ${fmtDateBR(data.dateRange.to)}</span>`,
        data.freshness.state === 'fresh' ? 'info' : 'warn'
      )}
      ${sellersBlock}
      ${sourceBlock}
      ${staleDealsBlock}
      ${pendingInvoicesBlock}
      ${missingProcessBlock}
    `;

    const html = renderBaseLayout({
      title: 'BI Comercial diario',
      preheader: `${fmtDateBR(data.dateRange.to)} · Pipeline ${$$(data.summary.openPipelineValue)} · Fechado ${$$(data.summary.wonValue)} · ${data.summary.sellerCount} vendedores`,
      bodyHtml,
      ctaLabel: 'Abrir BI Comercial',
      ctaUrl: `${APP_URL}/dashboard/commercial-bi`,
      footerNote: `Automated commercial digest · ${fmtDateBR(data.dateRange.to)}`,
    });

    await this.sendEmailWithTracking(
      user.email,
      subject,
      html,
      NotificationType.SELLER_DAILY_DIGEST,
      {}
    );
  }

  async sendFinanceDailyDigest(user: User, data: FinanceDigestData): Promise<void> {
    const subject = `Resumo financeiro — ${data.date}`;

    const arRows = [
      tableRow(['0-30 dias', fmtMoney(data.arAging.bucket0to30)]),
      tableRow(['31-60 dias', fmtMoney(data.arAging.bucket31to60)]),
      tableRow(['61-90 dias', fmtMoney(data.arAging.bucket61to90)]),
      tableRow([`<span style="color:${ERROR_RED}; font-weight:bold;">90+ dias</span>`, `<strong>${fmtMoney(data.arAging.bucket90Plus)}</strong>`]),
    ];

    const cashflowDeltaColor =
      data.cashflow.deltaPercent >= 0 ? BRAND_COLORS.verde : ERROR_RED;
    const cashflowSign = data.cashflow.deltaPercent >= 0 ? '+' : '';

    const syncErrorBlock =
      data.syncErrorInvoices.length > 0
        ? sectionTitle('Erros de sincronizacao QuickBooks (24h)') +
          dataTable(
            ['Fatura', 'Erro'],
            data.syncErrorInvoices.map((s) => tableRow([esc(s.invoiceNumber || s.id), esc(s.errorMessage)]))
          )
        : '';

    const bodyHtml = `
      <p>Ola <strong>${esc(user.name || 'equipe financeira')}</strong>,</p>

      ${sectionTitle('Aging de contas a receber')}
      ${dataTable(['Faixa', 'Valor'], arRows)}

      ${sectionTitle('Recebimentos esperados hoje')}
      <p style="font-size:18px;"><strong>${data.todayExpectedCollections.count}</strong> fatura(s) — <strong>${fmtMoney(data.todayExpectedCollections.amount)}</strong></p>

      ${sectionTitle('Cashflow')}
      <p>Mes atual: <strong>${fmtMoney(data.cashflow.revenueThisMonth)}</strong></p>
      <p>Mes anterior: <strong>${fmtMoney(data.cashflow.revenueLastMonth)}</strong></p>
      <p>Variacao: <strong style="color:${cashflowDeltaColor};">${cashflowSign}${data.cashflow.deltaPercent.toFixed(1)}%</strong></p>

      ${syncErrorBlock}

      ${sectionTitle('Faturas antigas (180+ dias)')}
      <p><strong>${data.staleInvoices.count}</strong> fatura(s) — <strong>${fmtMoney(data.staleInvoices.amount)}</strong></p>
    `;

    const html = renderBaseLayout({
      title: 'Resumo financeiro do dia',
      preheader: `Aging, recebimentos esperados e cashflow — ${data.date}`,
      bodyHtml,
      ctaLabel: 'Abrir dashboard financeiro',
      ctaUrl: `${APP_URL}/dashboard/financial`,
      footerNote: data.date,
    });

    await this.sendEmailWithTracking(
      user.email,
      subject,
      html,
      NotificationType.FINANCE_DAILY_DIGEST,
      {}
    );
  }

  async sendAdminWeeklyDigest(user: User, data: AdminDigestData): Promise<void> {
    const subject = `Resumo executivo semanal — ${data.weekRange}`;

    const mrrDeltaColor = data.mrr.deltaPercent >= 0 ? BRAND_COLORS.verde : ERROR_RED;
    const mrrSign = data.mrr.deltaPercent >= 0 ? '+' : '';

    const dealsAtRiskBlock =
      data.dealsAtRisk.length > 0
        ? sectionTitle('Top 5 negocios em risco') +
          dataTable(
            ['Negocio', 'Valor', 'Owner', 'Sem atividade'],
            data.dealsAtRisk.map((d) =>
              tableRow([esc(d.title), fmtMoney(d.value), esc(d.ownerName), `${d.lastActivityDays} dias`])
            )
          )
        : '';

    const funnelBlock = `
      ${sectionTitle('Funil de conversao (semana)')}
      ${dataTable(
        ['Estagio', 'Quantidade'],
        [
          tableRow(['Leads', String(data.conversionFunnel.leads)]),
          tableRow(['Qualificados', String(data.conversionFunnel.qualified)]),
          tableRow(['Negociacoes', String(data.conversionFunnel.deals)]),
          tableRow(['Ganhas', `<strong style="color:${BRAND_COLORS.verde};">${data.conversionFunnel.won}</strong>`]),
        ]
      )}
    `;

    const sourceBlock =
      data.leadSourcePerformance.length > 0
        ? sectionTitle('Performance por fonte de leads') +
          dataTable(
            ['Fonte', 'Leads', 'Conversoes'],
            data.leadSourcePerformance.map((s) =>
              tableRow([esc(s.source), String(s.leads), String(s.conversions)])
            )
          )
        : '';

    const highlightsBlock =
      data.biHighlights.length > 0
        ? sectionTitle('Destaques de BI') +
          `<ul style="margin:8px 0 16px 20px;">${data.biHighlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>`
        : '';

    const cfoBlock = `
      ${sectionTitle('Insights do CFO IA')}
      <div style="background:${BRAND_COLORS.creme}; border:1px solid ${BRAND_COLORS.cafeLeite}; border-radius:6px; padding:14px; font-size:14px; white-space:pre-wrap; color:${BRAND_COLORS.textDark};">${esc(data.cfoInsights)}</div>
    `;

    const bodyHtml = `
      <p>Ola <strong>${esc(user.name || 'admin')}</strong>,</p>
      <p>Resumo executivo da semana <strong>${esc(data.weekRange)}</strong>.</p>

      ${sectionTitle('MRR')}
      <p style="font-size:22px;"><strong>${fmtMoney(data.mrr.current)}</strong> <span style="font-size:14px; color:${mrrDeltaColor}; font-weight:bold;">(${mrrSign}${data.mrr.deltaPercent.toFixed(1)}% vs semana anterior, ${mrrSign}${fmtMoney(data.mrr.deltaWeek)})</span></p>

      ${dealsAtRiskBlock}
      ${funnelBlock}
      ${sourceBlock}
      ${highlightsBlock}
      ${cfoBlock}
    `;

    const html = renderBaseLayout({
      title: 'Resumo executivo semanal',
      preheader: `Resumo executivo — ${data.weekRange}`,
      bodyHtml,
      ctaLabel: 'Abrir dashboard executivo',
      ctaUrl: `${APP_URL}/dashboard`,
      footerNote: data.weekRange,
    });

    await this.sendEmailWithTracking(
      user.email,
      subject,
      html,
      NotificationType.ADMIN_WEEKLY_DIGEST,
      {}
    );
  }

  // =========================================================================
  // Private HTML template generators (rebranded via renderBaseLayout)
  // =========================================================================

  private generateContractSignatureRequestEmail(contract: Contract, customer: Customer, invoiceNumber: string): string {
    const docusignUrl = contract.docusign_env_id
      ? `https://app.docusign.com/documents/details/${contract.docusign_env_id}`
      : `${APP_URL}/contract/${contract.id}`;

    const bodyHtml = `
      <p>Dear ${esc(customer.name)},</p>
      <p>Your service agreement is ready for signature. Please review and sign the contract to proceed with payment.</p>
      <div style="background:${BRAND_COLORS.creme}; border:1px solid ${BRAND_COLORS.cafeLeite}; border-radius:6px; padding:14px; margin:16px 0;">
        <h3 style="margin:0 0 8px 0; color:${BRAND_COLORS.verde}; font-size:15px;">Contract Information</h3>
        <p style="margin:4px 0;"><strong>Invoice:</strong> ${esc(invoiceNumber)}</p>
        <p style="margin:4px 0;"><strong>Recipient:</strong> ${esc(customer.name)}</p>
        <p style="margin:4px 0;"><strong>Email:</strong> ${esc(customer.email)}</p>
      </div>
      ${calloutBox('<strong>Important:</strong> This contract will expire in 30 days. Please sign it as soon as possible to avoid delays.', 'warn')}
      <p>If you have any questions, please contact our support team.</p>
    `;

    return renderBaseLayout({
      title: 'Contract ready for signature',
      preheader: `Sign your CarreiraUSA service agreement (Invoice ${invoiceNumber})`,
      bodyHtml,
      ctaLabel: 'Review & sign contract',
      ctaUrl: docusignUrl,
      footerNote: 'Sent via DocuSign on behalf of CarreiraUSA',
    });
  }

  private generateContractSignedEmail(contract: Contract, customer: Customer): string {
    const bodyHtml = `
      <p>Ola equipe financeira,</p>
      <p>O contrato com <strong>${esc(customer.name)}</strong> foi assinado.</p>
      <ul style="margin:12px 0; padding-left:20px;">
        <li><strong>Cliente:</strong> ${esc(customer.name)} (${esc(customer.email)})</li>
        <li><strong>Assinado em:</strong> ${esc(new Date().toLocaleString('pt-BR'))}</li>
      </ul>
      ${calloutBox('<strong>Proximos passos:</strong> link de pagamento sera enviado automaticamente. Acompanhe pelo dashboard.', 'info')}
    `;

    return renderBaseLayout({
      title: 'Contrato assinado',
      preheader: `Contrato com ${customer.name} foi assinado`,
      bodyHtml,
      ctaLabel: 'Abrir dashboard',
      ctaUrl: `${APP_URL}/dashboard/contracts/${contract.id}`,
    });
  }

  private generateContractExpiredEmail(contract: Contract, customer: Customer): string {
    const bodyHtml = `
      <p>Ola equipe financeira,</p>
      <p>Um contrato expirou sem assinatura.</p>
      <ul style="margin:12px 0; padding-left:20px;">
        <li><strong>Cliente:</strong> ${esc(customer.name)} (${esc(customer.email)})</li>
        <li><strong>Enviado em:</strong> ${esc(contract.sentAt ? new Date(contract.sentAt).toLocaleDateString('pt-BR') : 'N/A')}</li>
        <li><strong>Expirado em:</strong> ${esc(contract.expiresAt ? new Date(contract.expiresAt).toLocaleDateString('pt-BR') : 'N/A')}</li>
        <li><strong>Lembretes enviados:</strong> ${contract.reminderCount}</li>
      </ul>
      ${calloutBox('Faca follow-up com o cliente para entender o motivo e reenviar caso necessario.', 'warn')}
    `;

    return renderBaseLayout({
      title: 'Contrato expirado',
      preheader: `Contrato com ${customer.name} expirou sem assinatura`,
      bodyHtml,
      ctaLabel: 'Abrir contrato',
      ctaUrl: `${APP_URL}/dashboard/contracts/${contract.id}`,
    });
  }

  private generatePaymentLinkEmail(invoice: Invoice, customer: Customer, paymentUrl: string): string {
    const bodyHtml = `
      <p>Dear ${esc(customer.name)},</p>
      <p>Thank you for signing the contract! You can now proceed with the payment.</p>
      <div style="background:${BRAND_COLORS.creme}; border:1px solid ${BRAND_COLORS.cafeLeite}; border-radius:6px; padding:14px; margin:16px 0;">
        <h3 style="margin:0 0 8px 0; color:${BRAND_COLORS.verde}; font-size:15px;">Invoice details</h3>
        <p style="margin:4px 0;"><strong>Invoice number:</strong> ${esc(invoice.invoiceNumber || invoice.id)}</p>
        <p style="margin:4px 0;"><strong>Due date:</strong> ${esc(new Date(invoice.dueDate).toLocaleDateString('en-US'))}</p>
        <div style="font-size:30px; color:${BRAND_COLORS.verde}; font-weight:bold; text-align:center; margin-top:12px;">${fmtMoney(Number(invoice.amount))}</div>
      </div>
      <p style="font-size:14px; color:${BRAND_COLORS.textMuted};"><strong>Payment methods accepted:</strong> Credit Card · Debit Card · ACH Transfer</p>
      <p style="font-size:14px; color:${BRAND_COLORS.textMuted};">You will receive a payment confirmation once the transaction is complete.</p>
    `;

    return renderBaseLayout({
      title: 'Payment link ready',
      preheader: `Pay invoice ${invoice.invoiceNumber || invoice.id} — ${fmtMoney(Number(invoice.amount))}`,
      bodyHtml,
      ctaLabel: 'Pay now',
      ctaUrl: paymentUrl,
      footerNote: 'Secure payments powered by QuickBooks',
    });
  }

  private generatePaymentReminderEmail(invoice: Invoice, customer: Customer, paymentUrl: string, daysUntilDue: number): string {
    const urgent = daysUntilDue <= 1;
    const tone: 'warn' | 'error' = urgent ? 'error' : 'warn';

    const bodyHtml = `
      <p>Dear ${esc(customer.name)},</p>
      <p>This is a ${urgent ? 'final' : 'friendly'} reminder about your pending payment.</p>
      ${calloutBox(
        `<h4 style="margin:0 0 8px 0; color:${BRAND_COLORS.verde};">Due in ${daysUntilDue} ${daysUntilDue === 1 ? 'day' : 'days'}</h4>
         <p style="margin:4px 0;"><strong>Invoice:</strong> ${esc(invoice.invoiceNumber || invoice.id)}</p>
         <p style="margin:4px 0;"><strong>Amount:</strong> ${fmtMoney(Number(invoice.amount))}</p>
         <p style="margin:4px 0;"><strong>Due date:</strong> ${esc(new Date(invoice.dueDate).toLocaleDateString('en-US'))}</p>`,
        tone
      )}
      <p>Please process this payment as soon as possible to avoid any service interruptions.</p>
      <p style="font-size:13px; color:${BRAND_COLORS.textMuted};">If you have already made the payment, please disregard this message.</p>
    `;

    return renderBaseLayout({
      title: urgent ? 'Urgent: payment reminder' : 'Payment reminder',
      preheader: `Invoice ${invoice.invoiceNumber || invoice.id} due in ${daysUntilDue} day(s)`,
      bodyHtml,
      ctaLabel: 'Pay now',
      ctaUrl: paymentUrl,
    });
  }

  private generatePaymentReceivedEmail(invoice: Invoice, customer: Customer): string {
    const bodyHtml = `
      <p>Dear ${esc(customer.name)},</p>
      <p>Thank you! Your payment has been received and processed successfully.</p>
      <div style="background:${BRAND_COLORS.creme}; border:1px solid ${BRAND_COLORS.cafeLeite}; border-radius:6px; padding:14px; margin:16px 0;">
        <h3 style="margin:0 0 8px 0; color:${BRAND_COLORS.verde}; font-size:15px;">Payment confirmation</h3>
        <p style="margin:4px 0;"><strong>Invoice number:</strong> ${esc(invoice.invoiceNumber || invoice.id)}</p>
        <p style="margin:4px 0;"><strong>Amount paid:</strong> ${fmtMoney(Number(invoice.amount))}</p>
        <p style="margin:4px 0;"><strong>Payment date:</strong> ${esc(new Date().toLocaleDateString('en-US'))}</p>
        <p style="margin:4px 0;"><strong>Status:</strong> <span style="color:${BRAND_COLORS.verde}; font-weight:bold;">PAID</span></p>
      </div>
      <p>A receipt has been sent to your email address. You can also view this invoice in your customer portal.</p>
      <p style="font-size:13px; color:${BRAND_COLORS.textMuted};">If you have any questions about this payment, please contact our support team.</p>
    `;

    return renderBaseLayout({
      title: 'Payment received successfully',
      preheader: `Thank you — payment of ${fmtMoney(Number(invoice.amount))} received`,
      bodyHtml,
      ctaLabel: 'View in portal',
      ctaUrl: `${APP_URL}/hub/login`,
      footerNote: 'Thank you for your business!',
    });
  }

  private generateHubWelcomeEmail(customer: { name: string; email: string }, tempPassword: string): string {
    const portalUrl = `${APP_URL}/hub/login`;

    const bodyHtml = `
      <p>Dear ${esc(customer.name)},</p>
      <p>Your client portal is ready. You can now access your invoices, contracts, and account information in one place.</p>
      <div style="background:${BRAND_COLORS.creme}; border:1px solid ${BRAND_COLORS.cafeLeite}; border-radius:8px; padding:18px; margin:18px 0;">
        <div style="font-size:12px; color:${BRAND_COLORS.textMuted}; text-transform:uppercase; font-weight:bold; letter-spacing:0.5px; margin-bottom:8px;">Your login credentials</div>
        <div style="font-size:15px; margin-bottom:6px;"><strong>Portal:</strong> <a href="${esc(portalUrl)}" style="color:${BRAND_COLORS.verde};">${esc(portalUrl)}</a></div>
        <div style="font-size:15px; margin-bottom:6px;"><strong>Email:</strong> ${esc(customer.email)}</div>
        <div style="font-size:15px;"><strong>Temporary password:</strong> <span style="font-family:monospace; background:${BRAND_COLORS.white}; padding:3px 8px; border-radius:4px; border:1px solid ${BRAND_COLORS.cafeLeite};">${esc(tempPassword)}</span></div>
      </div>
      ${calloutBox('<strong>Important:</strong> Please change your password on first login. Your temporary password expires in 24 hours.', 'warn')}
      <p style="font-size:13px; color:${BRAND_COLORS.textMuted};">If you have any questions, please contact our support team.</p>
    `;

    return renderBaseLayout({
      title: 'Welcome to Carreira U.S.A.',
      preheader: 'Your client portal is ready',
      bodyHtml,
      ctaLabel: 'Access your portal',
      ctaUrl: portalUrl,
      footerNote: 'Do not reply to this email',
    });
  }

  private generateHubAccessInviteEmail(
    customer: { name: string; email: string; preferredLanguage?: string | null },
    setupUrl: string
  ): string {
    const isPt = customer.preferredLanguage === "pt-BR";
    const bodyHtml = isPt
      ? `
      <p>Olá ${esc(customer.name)},</p>
      <p>Sua matrícula foi criada e o seu portal do cliente já está pronto.</p>
      <p>Use o botão abaixo para criar sua senha de acesso e entrar no Hub da Carreira U.S.A.</p>
      ${calloutBox('<strong>Este link expira em 72 horas.</strong> Por segurança, não compartilhe este link com ninguém.', 'warn')}
      <div style="background:${BRAND_COLORS.creme}; border:1px solid ${BRAND_COLORS.cafeLeite}; border-radius:8px; padding:16px; margin:16px 0;">
        <div style="font-size:15px;"><strong>E-mail de acesso:</strong> ${esc(customer.email)}</div>
      </div>
    `
      : `
      <p>Dear ${esc(customer.name)},</p>
      <p>Your enrollment has been created and your client portal is ready.</p>
      <p>Use the button below to set your password and access your Carreira U.S.A. Hub.</p>
      ${calloutBox('<strong>This link expires in 72 hours.</strong> For your security, do not share this link with anyone.', 'warn')}
      <div style="background:${BRAND_COLORS.creme}; border:1px solid ${BRAND_COLORS.cafeLeite}; border-radius:8px; padding:16px; margin:16px 0;">
        <div style="font-size:15px;"><strong>Login email:</strong> ${esc(customer.email)}</div>
      </div>
    `;

    return renderBaseLayout({
      title: isPt ? "Portal do cliente" : "Client portal",
      preheader: isPt ? "Crie sua senha e acesse seu Hub" : "Set your password and access your Hub",
      bodyHtml,
      ctaLabel: isPt ? "Criar senha e acessar portal" : "Set password and access portal",
      ctaUrl: setupUrl,
      footerNote: isPt ? "Não responda este email" : "Do not reply to this email",
    });
  }

  private generateHubInvoiceAvailableEmail(
    customer: { name: string; email: string },
    invoice: { id: string; invoiceNumber: string | null; amount: any }
  ): string {
    const portalUrl = `${APP_URL}/hub/login`;

    const bodyHtml = `
      <p>Dear ${esc(customer.name)},</p>
      <p>A new invoice has been issued to your account and is available for review in your client portal.</p>
      <div style="background:${BRAND_COLORS.creme}; border:1px solid ${BRAND_COLORS.cafeLeite}; border-radius:6px; padding:14px; margin:16px 0;">
        <h3 style="margin:0 0 8px 0; color:${BRAND_COLORS.verde}; font-size:15px;">Invoice details</h3>
        <p style="margin:4px 0;"><strong>Invoice number:</strong> ${esc(invoice.invoiceNumber || invoice.id)}</p>
        <div style="font-size:28px; color:${BRAND_COLORS.verde}; font-weight:bold; text-align:center; margin-top:12px;">${fmtMoney(Number(invoice.amount))}</div>
      </div>
      <p>Access your portal to view the full invoice details and make a payment.</p>
      <p style="font-size:13px; color:${BRAND_COLORS.textMuted};">If you have any questions about this invoice, please contact our support team.</p>
    `;

    return renderBaseLayout({
      title: 'New invoice available',
      preheader: `Invoice ${invoice.invoiceNumber || invoice.id} — ${fmtMoney(Number(invoice.amount))}`,
      bodyHtml,
      ctaLabel: 'View invoice in portal',
      ctaUrl: portalUrl,
      footerNote: 'Do not reply to this email',
    });
  }

  // ----- Autopay templates (PT-BR) -----

  private generateHubAutopayScheduledEmail(
    customer: { name: string; email: string },
    invoice: { id: string; invoiceNumber: string | null; amount: any; dueDate: Date },
    method: { type: 'card' | 'ach'; last4: string; brand?: string }
  ): string {
    const invNum = esc(invoice.invoiceNumber || invoice.id.slice(0, 8));
    const due = fmtDateBR(invoice.dueDate);
    const amount = fmtMoney(Number(invoice.amount));
    const portalUrl = `${APP_URL}/hub/login`;

    const bodyHtml = `
      <p>Olá ${esc(customer.name)},</p>
      <p>Uma nova fatura foi gerada na sua conta. Ela será cobrada <strong>automaticamente</strong> na data de vencimento, conforme previsto em contrato.</p>
      <div style="background:${BRAND_COLORS.creme}; border:1px solid ${BRAND_COLORS.cafeLeite}; border-radius:6px; padding:14px; margin:16px 0;">
        <h3 style="margin:0 0 8px 0; color:${BRAND_COLORS.verde}; font-size:15px;">Detalhes da fatura</h3>
        <p style="margin:4px 0;"><strong>Fatura:</strong> #${invNum}</p>
        <p style="margin:4px 0;"><strong>Valor:</strong> ${amount}</p>
        <p style="margin:4px 0;"><strong>Vencimento:</strong> ${esc(due)}</p>
        <p style="margin:4px 0;"><strong>Método de cobrança:</strong> ${esc(describeMethod(method))}</p>
      </div>
      <p>Não é necessária nenhuma ação. No dia do vencimento, o valor será debitado automaticamente do método cadastrado acima.</p>
      <p style="font-size:13px; color:${BRAND_COLORS.textMuted};">Se precisar trocar o método de pagamento ou tiver qualquer dúvida, fale com o nosso suporte antes da data de vencimento.</p>
    `;

    return renderBaseLayout({
      title: 'Nova fatura — cobrança automática',
      preheader: `Fatura #${invNum} de ${amount} será cobrada em ${due}`,
      bodyHtml,
      ctaLabel: 'Ver fatura no portal',
      ctaUrl: portalUrl,
      footerNote: 'Este é um e-mail automático. Por favor, não responda.',
    });
  }

  private generateHubAutopayReceiptEmail(
    customer: { name: string; email: string },
    invoice: { id: string; invoiceNumber: string | null; amount: any },
    method: { type: 'card' | 'ach'; last4: string; brand?: string }
  ): string {
    const invNum = esc(invoice.invoiceNumber || invoice.id.slice(0, 8));
    const amount = fmtMoney(Number(invoice.amount));
    const paidAt = fmtDateBR(new Date());
    const portalUrl = `${APP_URL}/hub/login`;

    const bodyHtml = `
      <p>Olá ${esc(customer.name)},</p>
      <p>Seu pagamento foi processado com sucesso. Obrigado!</p>
      <div style="background:${BRAND_COLORS.creme}; border:1px solid ${BRAND_COLORS.cafeLeite}; border-radius:6px; padding:14px; margin:16px 0;">
        <h3 style="margin:0 0 8px 0; color:${BRAND_COLORS.verde}; font-size:15px;">Recibo de pagamento</h3>
        <p style="margin:4px 0;"><strong>Fatura:</strong> #${invNum}</p>
        <p style="margin:4px 0;"><strong>Valor cobrado:</strong> ${amount}</p>
        <p style="margin:4px 0;"><strong>Data:</strong> ${esc(paidAt)}</p>
        <p style="margin:4px 0;"><strong>Método:</strong> ${esc(describeMethod(method))}</p>
        <p style="margin:4px 0;"><strong>Status:</strong> <span style="color:${BRAND_COLORS.verde}; font-weight:bold;">PAGO</span></p>
      </div>
      <p>Você pode acessar o portal do cliente para revisar o histórico de pagamentos e baixar o comprovante.</p>
      <p style="font-size:13px; color:${BRAND_COLORS.textMuted};">Em caso de dúvidas sobre este pagamento, entre em contato com o suporte.</p>
    `;

    return renderBaseLayout({
      title: 'Pagamento automático processado',
      preheader: `Pagamento de ${amount} recebido — Fatura #${invNum}`,
      bodyHtml,
      ctaLabel: 'Ver no portal',
      ctaUrl: portalUrl,
      footerNote: 'Obrigado pela parceria.',
    });
  }

  private generateHubAutopayFailedEmail(
    customer: { name: string; email: string },
    invoice: { id: string; invoiceNumber: string | null; amount: any; dueDate: Date },
    method: { type: 'card' | 'ach'; last4: string; brand?: string },
    nextRetry: Date | null,
    isFinalAttempt: boolean
  ): string {
    const invNum = esc(invoice.invoiceNumber || invoice.id.slice(0, 8));
    const amount = fmtMoney(Number(invoice.amount));
    const payUrl = `${APP_URL}/hub/pay/${invoice.id}`;

    const statusLine = isFinalAttempt
      ? `<p><strong>Esgotamos as tentativas automáticas.</strong> Por favor, regularize o pagamento manualmente clicando no botão abaixo.</p>`
      : nextRetry
        ? `<p>Faremos uma nova tentativa automaticamente em <strong>${esc(fmtDateBR(nextRetry))}</strong>. Se preferir, você pode pagar agora manualmente.</p>`
        : `<p>Faremos uma nova tentativa automaticamente nos próximos dias. Se preferir, você pode pagar agora manualmente.</p>`;

    const bodyHtml = `
      <p>Olá ${esc(customer.name)},</p>
      <p>Tentamos processar a cobrança automática da fatura abaixo, mas não foi possível.</p>
      <div style="background:${BRAND_COLORS.creme}; border:1px solid ${BRAND_COLORS.cafeLeite}; border-radius:6px; padding:14px; margin:16px 0;">
        <h3 style="margin:0 0 8px 0; color:${ERROR_RED}; font-size:15px;">Cobrança não processada</h3>
        <p style="margin:4px 0;"><strong>Fatura:</strong> #${invNum}</p>
        <p style="margin:4px 0;"><strong>Valor:</strong> ${amount}</p>
        <p style="margin:4px 0;"><strong>Vencimento:</strong> ${esc(fmtDateBR(invoice.dueDate))}</p>
        <p style="margin:4px 0;"><strong>Método tentado:</strong> ${esc(describeMethod(method))}</p>
      </div>
      ${statusLine}
      ${calloutBox('Motivos comuns: cartão recusado pelo banco, limite insuficiente, cartão expirado ou dados desatualizados. Se o problema persistir, atualize seu método no portal ou fale com o suporte.', 'warn')}
    `;

    return renderBaseLayout({
      title: isFinalAttempt ? 'Ação necessária: cobrança automática falhou' : 'Cobrança automática não processada',
      preheader: isFinalAttempt
        ? `Fatura #${invNum} precisa ser paga manualmente`
        : `Tentaremos novamente — fatura #${invNum}`,
      bodyHtml,
      ctaLabel: 'Pagar agora manualmente',
      ctaUrl: payUrl,
      footerNote: 'Se já efetuou o pagamento, desconsidere este aviso.',
    });
  }

  private generateHubPasswordResetEmail(customer: { name: string; email: string }, resetUrl: string): string {
    const bodyHtml = `
      <p>Dear ${esc(customer.name)},</p>
      <p>We received a request to reset the password for your Carreira U.S.A. client portal account.</p>
      <p>Click the button below to reset your password:</p>
      ${calloutBox('<strong>This link expires in 1 hour.</strong> If you did not request a password reset, you can safely ignore this email.', 'warn')}
      <div style="background:${BRAND_COLORS.creme}; border:1px solid ${BRAND_COLORS.cafeLeite}; border-radius:6px; padding:14px; margin:16px 0;">
        <h4 style="margin:0 0 6px 0; color:${BRAND_COLORS.verde};">Security notice</h4>
        <p style="margin:0; font-size:14px;">For your protection, never share this link with anyone. Carreira U.S.A. will never ask for your password via email or phone.</p>
      </div>
      <p style="font-size:13px; color:${BRAND_COLORS.textMuted};">If you did not request this reset, please contact our support team immediately.</p>
    `;

    return renderBaseLayout({
      title: 'Password reset',
      preheader: 'Reset your Carreira U.S.A. portal password',
      bodyHtml,
      ctaLabel: 'Reset password',
      ctaUrl: resetUrl,
      footerNote: 'Do not reply to this email',
    });
  }

  async sendAdminDailyDigest(user: { name?: string | null; email: string }, data: AdminDailyDigestData): Promise<void> {
    const subject = `Daily BI Drop — ${data.date}`;

    const $$ = (n: number) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    const pct = (n: number) => `${Number(n || 0).toFixed(1)}%`;

    // Only show trend arrows if current month >= day 25 (month is near complete)
    const today = new Date();
    const monthIsComplete = today.getDate() >= 25;
    const trend = (curr: number, prev: number) => {
      if (!prev || !monthIsComplete) return '';
      const d = ((curr - prev) / prev) * 100;
      const color = d >= 0 ? BRAND_COLORS.verde : ERROR_RED;
      const arrow = d >= 0 ? '▲' : '▼';
      return `<span style="font-size:11px;color:${color};margin-left:6px;">${arrow} ${Math.abs(d).toFixed(1)}%</span>`;
    };

    const m = data.financial.monthlyTrend; // [M-2, M-1, M0]
    const cm = data.commercial.monthlyTrend;
    // Current month label shows MTD note when partial
    const currLabel = monthIsComplete
      ? `<strong>${m[2].label}</strong>`
      : `<strong>${m[2].label} <span style="font-size:10px;font-weight:normal;">(MTD)</span></strong>`;

    // ── Today snapshot strip ──────────────────────────────────────────────────
    const todayStrip = `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
        <tr>
          ${[
            { label: 'Revenue today', val: $$(data.today.revenueToday), color: BRAND_COLORS.verde },
            { label: 'Deals won today', val: String(data.today.dealsWonToday), color: data.today.dealsWonToday > 0 ? BRAND_COLORS.verde : BRAND_COLORS.textMuted },
            { label: 'New leads today', val: String(data.today.leadsToday), color: BRAND_COLORS.textDark },
            { label: 'MRR', val: $$(data.financial.mrr), color: BRAND_COLORS.textDark },
          ].map(({ label, val, color }) => `
            <td width="25%" style="padding:0 6px 0 0;">
              <div style="background:${BRAND_COLORS.creme};border:1px solid ${BRAND_COLORS.cafeLeite};border-radius:6px;padding:10px;text-align:center;">
                <div style="font-size:11px;color:${BRAND_COLORS.textMuted};margin-bottom:4px;">${label}</div>
                <div style="font-size:18px;font-weight:bold;color:${color};">${val}</div>
              </div>
            </td>
          `).join('')}
        </tr>
      </table>`;

    // ── Financial monthly trend table ─────────────────────────────────────────
    const finTrend = `
      ${sectionTitle('Financial — Monthly Trend')}
      ${dataTableRaw(
        ['', m[0].label, m[1].label, currLabel],
        [
          tableRow(['Revenue collected', $$(m[0].revenue), $$(m[1].revenue), `<strong>${$$(m[2].revenue)}</strong>${trend(m[2].revenue, m[1].revenue)}`]),
          tableRow(['Invoiced', $$(m[0].invoiced), $$(m[1].invoiced), `<strong>${$$(m[2].invoiced)}</strong>${trend(m[2].invoiced, m[1].invoiced)}`]),
          tableRow(['# New invoices', String(m[0].newInvoices), String(m[1].newInvoices), `<strong>${m[2].newInvoices}</strong>`]),
          tableRow(['Collection Rate', pct(m[0].collectionRate), pct(m[1].collectionRate), `<strong>${pct(m[2].collectionRate)}</strong>${trend(m[2].collectionRate, m[1].collectionRate)}`]),
        ]
      )}`;

    const cost = data.financial.costBreakdown;
    const costBreakdownBlock = cost ? `
      ${sectionTitle(`COGS & Expense Mix — ${cost.periodLabel}`)}
      <p style="font-size:13px;margin:0 0 8px 0;">
        Cost mix: <strong>COGS ${pct(cost.cogsSharePct)}</strong> / <strong>OpEx ${pct(cost.expensesSharePct)}</strong>
        &nbsp;|&nbsp; COGS:OpEx <strong>${cost.cogsToExpenseRatio == null ? 'n/a' : `${cost.cogsToExpenseRatio.toFixed(2)}x`}</strong>
        &nbsp;|&nbsp; Gross margin <strong>${pct(cost.grossMarginPct)}</strong>
      </p>
      ${dataTable(
        ['Metric', 'Amount'],
        [
          tableRow(['Revenue', `<strong>${$$(cost.revenue)}</strong>`]),
          tableRow(['COGS', `<strong>${$$(cost.cogsTotal)}</strong>`]),
          tableRow(['Operating expenses', `<strong>${$$(cost.operatingExpensesTotal)}</strong>`]),
          tableRow(['Total cost base', `<strong>${$$(cost.totalCost)}</strong>`]),
        ]
      )}
      ${cost.cogsByCategory.length > 0 ? `
        ${sectionTitle('COGS Breakdown')}
        ${dataTable(
          ['Category', 'Amount', '% of COGS'],
          cost.cogsByCategory.map((category) =>
            tableRow([esc(category.category), `<strong>${$$(category.amount)}</strong>`, pct(category.pctOfCogs)])
          )
        )}
      ` : ''}
      ${cost.expensesByCategory.length > 0 ? `
        ${sectionTitle('Operating Expense Breakdown')}
        ${dataTable(
          ['Category', 'Amount', '% of OpEx'],
          cost.expensesByCategory.map((category) =>
            tableRow([esc(category.category), `<strong>${$$(category.amount)}</strong>`, pct(category.pctOfExpenses)])
          )
        )}
      ` : ''}
    ` : '';

    // ── Annual trend (trailing 12 months) ────────────────────────────────────
    const annTrend = `
      ${sectionTitle('Annual Trend — Trailing 12 Months')}
      ${dataTableRaw(
        ['Month', 'Revenue Collected', 'Invoiced', 'Deals Won', 'New Leads'],
        data.financial.annualTrend.map((row, i) => {
          const isCurrentMonth = i === data.financial.annualTrend.length - 1;
          const label = isCurrentMonth && !monthIsComplete
            ? `<strong>${row.label} <span style="font-size:10px;font-weight:normal;">(MTD)</span></strong>`
            : isCurrentMonth ? `<strong>${row.label}</strong>` : row.label;
          return tableRow([
            label,
            isCurrentMonth ? `<strong>${$$(row.revenue)}</strong>` : $$(row.revenue),
            isCurrentMonth ? `<strong>${$$(row.invoiced)}</strong>` : $$(row.invoiced),
            isCurrentMonth ? `<strong>${row.dealsWon}</strong>` : String(row.dealsWon),
            isCurrentMonth ? `<strong>${row.newLeads}</strong>` : String(row.newLeads),
          ]);
        })
      )}`;

    // ── AR Aging ──────────────────────────────────────────────────────────────
    const deliqColor = data.financial.delinquencyRate > 25 ? ERROR_RED : data.financial.delinquencyRate > 12 ? '#B45309' : BRAND_COLORS.verde;
    const arAging = `
      ${sectionTitle('AR Aging (Current Open Invoices)')}
      <p style="font-size:13px;margin:0 0 8px 0;">
        Total AR: <strong>${$$(data.financial.totalAR)}</strong> &nbsp;|&nbsp;
        Delinquency Rate: <strong style="color:${deliqColor};">${pct(data.financial.delinquencyRate)}</strong> &nbsp;|&nbsp;
        Overdue: <strong style="color:${ERROR_RED};">${$$(data.financial.overdueAmount)}</strong>
      </p>
      ${dataTable(
        ['Aging Bucket', 'Invoices', 'Amount'],
        data.financial.arAging.map(b => {
          const pctOfTotal = data.financial.totalAR > 0 ? ((b.amount / data.financial.totalAR) * 100).toFixed(0) : '0';
          const amtColor = b.label.includes('Current') ? BRAND_COLORS.verde : b.label.includes('90+') ? ERROR_RED : BRAND_COLORS.textDark;
          return tableRow([esc(b.label), String(b.count), `<span style="color:${amtColor};font-weight:bold;">${$$(b.amount)}</span> <span style="font-size:11px;color:${BRAND_COLORS.textMuted};">(${pctOfTotal}%)</span>`]);
        })
      )}`;

    // ── Top overdue ───────────────────────────────────────────────────────────
    const topOverdueBlock = data.financial.topOverdue.length > 0 ? `
      ${sectionTitle('Top Overdue Invoices')}
      ${dataTable(
        ['Customer', 'Invoice #', 'Amount', 'Days overdue'],
        data.financial.topOverdue.map(o =>
          tableRow([esc(o.customer), esc(o.invoiceNumber), `<strong style="color:${ERROR_RED};">${$$(o.amount)}</strong>`, `${o.daysOverdue}d`])
        )
      )}` : '';

    // ── Payment methods ───────────────────────────────────────────────────────
    const pmBlock = data.financial.paymentMethods.length > 0 ? `
      ${sectionTitle('Payment Methods (This Month)')}
      ${dataTable(
        ['Method', 'Amount'],
        data.financial.paymentMethods.map(pm =>
          tableRow([esc(pm.method || 'Other'), $$(pm.amount)])
        )
      )}` : '';

    // ── Commercial monthly trend ──────────────────────────────────────────────
    const commTrend = `
      ${sectionTitle('Commercial — Monthly Trend')}
      ${dataTableRaw(
        ['', cm[0].label, cm[1].label, currLabel],
        [
          tableRow(['Deals WON', String(cm[0].dealsWon), String(cm[1].dealsWon), `<strong>${cm[2].dealsWon}</strong>${trend(cm[2].dealsWon, cm[1].dealsWon)}`]),
          tableRow(['Revenue won', $$(cm[0].wonValue), $$(cm[1].wonValue), `<strong>${$$(cm[2].wonValue)}</strong>${trend(cm[2].wonValue, cm[1].wonValue)}`]),
          tableRow(['New leads', String(cm[0].newLeads), String(cm[1].newLeads), `<strong>${cm[2].newLeads}</strong>${trend(cm[2].newLeads, cm[1].newLeads)}`]),
          tableRow(['Qualified leads', String(cm[0].qualified), String(cm[1].qualified), `<strong>${cm[2].qualified}</strong>${trend(cm[2].qualified, cm[1].qualified)}`]),
        ]
      )}
      <p style="font-size:12px;margin:4px 0 0;color:${BRAND_COLORS.textMuted};">
        This week: ${data.week.dealsWonWeek} deals won · ${data.week.leadsWeek} new leads
      </p>`;

    // ── Top closers ───────────────────────────────────────────────────────────
    const closersBlock = data.commercial.topClosers.length > 0 ? `
      ${sectionTitle(`Top Closers — ${data.financial.monthlyTrend[2].label}`)}
      ${dataTable(
        ['#', 'Closer', 'Deals', 'Revenue'],
        data.commercial.topClosers.map((c, i) =>
          tableRow([`${i + 1}`, esc(c.name), String(c.won), `<strong>${$$(c.value)}</strong>`])
        )
      )}` : '';

    // ── Lead funnel ───────────────────────────────────────────────────────────
    const funnelColors: Record<string, string> = {
      NEW: '#93c5fd', QUALIFYING: '#60a5fa', QUALIFIED: BRAND_COLORS.verde,
      UNQUALIFIED: '#f97316', CONVERTED: '#16a34a', LOST: ERROR_RED,
    };
    const funnelTotal = data.commercial.leadFunnel.find(f => f.status === 'NEW')?.count || 1;
    const funnelBlock = `
      ${sectionTitle(`Lead Funnel — ${data.financial.monthlyTrend[2].label} · Avg score ${data.commercial.avgQualificationScore}`)}
      ${dataTable(
        ['Stage', 'Count', '% of new'],
        data.commercial.leadFunnel.map(f => {
          const color = funnelColors[f.status] ?? BRAND_COLORS.textMuted;
          return tableRow([
            `<span style="color:${color};font-weight:bold;">${f.status}</span>`,
            String(f.count),
            `${((f.count / funnelTotal) * 100).toFixed(0)}%`,
          ]);
        })
      )}`;

    // ── Lead sources ──────────────────────────────────────────────────────────
    const sourcesBlock = data.commercial.leadSources.length > 0 ? `
      ${sectionTitle('Leads by Source (This Month)')}
      ${dataTable(
        ['Source', 'Leads'],
        data.commercial.leadSources.map(s => tableRow([esc(s.source), String(s.count)]))
      )}` : '';

    // ── Operations ────────────────────────────────────────────────────────────
    const em = data.operations.monthlyEnrollments;
    const opsBlock = `
      ${sectionTitle('Operations — Enrollments by Month')}
      ${dataTable(
        ['', em[0].label, em[1].label, `<strong>${em[2].label}</strong>`],
        [
          tableRow(['Total enrolled', String(em[0].total), String(em[1].total), `<strong>${em[2].total}</strong>${trend(em[2].total, em[1].total)}`]),
          tableRow(['PASS', String(em[0].pass), String(em[1].pass), `<strong>${em[2].pass}</strong>`]),
          tableRow(['ADVANCED', String(em[0].advanced), String(em[1].advanced), `<strong>${em[2].advanced}</strong>`]),
        ]
      )}
      <p style="font-size:13px;margin:8px 0 0;color:${BRAND_COLORS.textMuted};">
        Active students: <strong style="color:${BRAND_COLORS.verde};">${data.operations.activeStudents}</strong> &nbsp;|&nbsp;
        Avg negotiation: <strong>${data.operations.avgNegotiationDays} days</strong>
      </p>`;

    const bodyHtml = `
      <p style="margin:0 0 16px;">Hi <strong>${esc(user.name || 'Admin')}</strong>, here is your end-of-day snapshot for <strong>${esc(data.date)}</strong>.</p>
      ${todayStrip}
      ${finTrend}
      ${costBreakdownBlock}
      ${annTrend}
      ${arAging}
      ${topOverdueBlock}
      ${pmBlock}
      ${commTrend}
      ${closersBlock}
      ${funnelBlock}
      ${sourcesBlock}
      ${opsBlock}
    `;

    const html = renderBaseLayout({
      title: 'Daily BI & Financial Drop',
      preheader: `${data.date} · MRR ${$$(data.financial.mrr)} · Delinq. ${pct(data.financial.delinquencyRate)} · Deals this week: ${data.week.dealsWonWeek}`,
      bodyHtml,
      ctaLabel: 'Open BI Dashboard',
      ctaUrl: `${APP_URL}/dashboard/bi`,
      footerNote: `Automated daily digest · ${data.date}`,
    });

    await this.sendEmailWithTracking(
      user.email,
      subject,
      html,
      NotificationType.ADMIN_WEEKLY_DIGEST,
      {}
    );
  }

  async sendExecutiveDailyDigest(user: { name?: string | null; email: string }, data: ExecutiveDailyDigestData): Promise<void> {
    const subject = `Resumo executivo diario - ${data.date}`;
    const currentFinancial = data.financial.monthlyTrend[data.financial.monthlyTrend.length - 1];
    const currentCommercial = data.commercial.monthlyTrend[data.commercial.monthlyTrend.length - 1];
    const currentOps = data.operations.monthlyEnrollments[data.operations.monthlyEnrollments.length - 1];
    const cfoGeneratedAt = data.aiCfo.generatedAt ? fmtDateBR(data.aiCfo.generatedAt) : null;
    const qbNeedsReconnect = !data.dataQuality.quickBooksConnected || data.dataQuality.quickBooksTokenExpired;

    const summaryStrip = `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px 0;">
        <tr>
          ${[
            { label: 'Receita hoje', value: fmtMoney(data.today.revenueToday), color: BRAND_COLORS.verde },
            { label: 'MRR', value: fmtMoney(data.financial.mrr), color: BRAND_COLORS.textDark },
            { label: 'AR aberto', value: fmtMoney(data.financial.totalAR), color: BRAND_COLORS.textDark },
            { label: 'Inadimplencia', value: `${data.financial.delinquencyRate.toFixed(1)}%`, color: data.financial.delinquencyRate > 15 ? ERROR_RED : BRAND_COLORS.verde },
          ].map(({ label, value, color }) => `
            <td width="25%" style="padding:0 6px 0 0;">
              <div style="background:${BRAND_COLORS.creme};border:1px solid ${BRAND_COLORS.cafeLeite};border-radius:6px;padding:10px;text-align:center;">
                <div style="font-size:11px;color:${BRAND_COLORS.textMuted};margin-bottom:4px;">${label}</div>
                <div style="font-size:17px;font-weight:bold;color:${color};">${value}</div>
              </div>
            </td>
          `).join('')}
        </tr>
      </table>`;

    const cfoBlock = `
      ${sectionTitle('Leitura da IA CFO')}
      ${data.aiCfo.isStale
        ? calloutBox('O insight da IA CFO esta desatualizado ou indisponivel. O email mantem os numeros operacionais atuais e evita inventar recomendacoes novas.', 'warn')
        : ''}
      <div style="background:${BRAND_COLORS.creme}; border:1px solid ${BRAND_COLORS.cafeLeite}; border-radius:6px; padding:14px; font-size:14px; color:${BRAND_COLORS.textDark};">
        <div style="white-space:pre-wrap;">${esc(data.aiCfo.briefing || 'Sem briefing recente da IA CFO.')}</div>
        ${data.aiCfo.recommendations.length > 0
          ? `<ul style="margin:10px 0 0 20px;">${data.aiCfo.recommendations.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`
          : ''}
        ${cfoGeneratedAt ? `<div style="font-size:12px;color:${BRAND_COLORS.textMuted};margin-top:10px;">Gerado em ${esc(cfoGeneratedAt)}${data.aiCfo.dateRange ? ` · ${esc(data.aiCfo.dateRange)}` : ''}</div>` : ''}
      </div>`;

    const qbWarning = qbNeedsReconnect
      ? calloutBox(
          `QuickBooks precisa reconectar. O token salvo expirou${data.dataQuality.quickBooksTokenExpiresAt ? ` em ${fmtDateBR(data.dataQuality.quickBooksTokenExpiresAt)}` : ''}; ate reconectar, relatorios de QB podem vir do cache ou do banco local.${data.dataQuality.latestQuickBooksError ? `<br><span style="font-size:12px;color:${BRAND_COLORS.textMuted};">Ultimo erro: ${esc(data.dataQuality.latestQuickBooksError)}</span>` : ''}`,
          'warn'
        )
      : '';

    const financeBlock = `
      ${sectionTitle('Financeiro')}
      ${dataTable(
        ['Indicador', 'Valor'],
        [
          tableRow(['Receita coletada no mes', `<strong>${fmtMoney(currentFinancial?.revenue || 0)}</strong>`]),
          tableRow(['Faturado no mes', fmtMoney(currentFinancial?.invoiced || 0)]),
          tableRow(['Taxa de cobranca', `${Number(currentFinancial?.collectionRate || 0).toFixed(1)}%`]),
          tableRow(['Atrasado em aberto', `<span style="color:${ERROR_RED};font-weight:bold;">${fmtMoney(data.financial.overdueAmount)}</span>`]),
        ]
      )}`;

    const commercialBlock = `
      ${sectionTitle('Comercial')}
      ${dataTable(
        ['Indicador', 'Valor'],
        [
          tableRow(['Deals ganhos na semana', String(data.week.dealsWonWeek)]),
          tableRow(['Leads na semana', String(data.week.leadsWeek)]),
          tableRow(['Receita ganha no mes', `<strong>${fmtMoney(currentCommercial?.wonValue || 0)}</strong>`]),
          tableRow(['Top closer do mes', data.commercial.topClosers[0] ? `${esc(data.commercial.topClosers[0].name)} · ${fmtMoney(data.commercial.topClosers[0].value)}` : 'Sem deals ganhos no mes']),
        ]
      )}`;

    const opsBlock = `
      ${sectionTitle('Operacoes')}
      ${dataTable(
        ['Indicador', 'Valor'],
        [
          tableRow(['Alunos ativos', String(data.operations.activeStudents)]),
          tableRow(['Novas matriculas no mes', String(currentOps?.total || 0)]),
          tableRow(['PASS / ADVANCED', `${currentOps?.pass || 0} / ${currentOps?.advanced || 0}`]),
          tableRow(['Tempo medio de negociacao', `${data.operations.avgNegotiationDays} dias`]),
        ]
      )}`;

    const overdueBlock = data.financial.topOverdue.length > 0
      ? `
        ${sectionTitle('Atencao de cobranca')}
        ${dataTable(
          ['Cliente', 'Invoice', 'Valor', 'Atraso'],
          data.financial.topOverdue.slice(0, 3).map((item) =>
            tableRow([
              esc(item.customer),
              esc(item.invoiceNumber),
              `<strong>${fmtMoney(item.amount)}</strong>`,
              `${item.daysOverdue} dias`,
            ])
          )
        )}`
      : '';

    const bodyHtml = `
      <p style="margin:0 0 16px;">Ola <strong>${esc(user.name || 'Thais')}</strong>, segue o report executivo diario com financeiro, comercial, operacoes e leitura da IA CFO.</p>
      ${summaryStrip}
      ${qbWarning}
      ${cfoBlock}
      ${financeBlock}
      ${commercialBlock}
      ${opsBlock}
      ${overdueBlock}
    `;

    const html = renderBaseLayout({
      title: 'Resumo executivo diario',
      preheader: `${data.date} · MRR ${fmtMoney(data.financial.mrr)} · AR ${fmtMoney(data.financial.totalAR)} · Deals semana ${data.week.dealsWonWeek}`,
      bodyHtml,
      ctaLabel: 'Abrir BI executivo',
      ctaUrl: `${APP_URL}/dashboard/bi`,
      footerNote: `Automated executive digest · ${data.date}`,
    });

    await this.sendEmailWithTracking(
      user.email,
      subject,
      html,
      NotificationType.ADMIN_WEEKLY_DIGEST,
      {}
    );
  }

  // =========================================================================
  // Hub — Form assigned notification
  // =========================================================================

  async sendHubFormAssigned(
    customer: { id: string; email: string; name: string },
    formTitle: string,
    tempPassword?: string
  ): Promise<void> {
    const portalUrl = `${APP_URL}/hub/login`;
    const firstName = esc(customer.name.split(' ')[0]);

    const credentialsBlock = tempPassword
      ? `
      <div style="background:${BRAND_COLORS.creme}; border:1px solid ${BRAND_COLORS.cafeLeite}; border-radius:8px; padding:18px; margin:18px 0;">
        <div style="font-size:12px; color:${BRAND_COLORS.textMuted}; text-transform:uppercase; font-weight:bold; letter-spacing:0.5px; margin-bottom:10px;">Seu acesso ao portal</div>
        <div style="font-size:15px; margin-bottom:6px;"><strong>Portal:</strong> <a href="${esc(portalUrl)}" style="color:${BRAND_COLORS.verde};">${esc(portalUrl)}</a></div>
        <div style="font-size:15px; margin-bottom:6px;"><strong>E-mail:</strong> ${esc(customer.email)}</div>
        <div style="font-size:15px;"><strong>Senha temporária:</strong> <span style="font-family:monospace; background:${BRAND_COLORS.white}; padding:3px 8px; border-radius:4px; border:1px solid ${BRAND_COLORS.cafeLeite};">${esc(tempPassword)}</span></div>
      </div>
      <p style="font-size:13px; color:${BRAND_COLORS.textMuted};">Você será solicitado(a) a criar uma senha definitiva no primeiro acesso.</p>`
      : '';

    const bodyHtml = `
      <p>Olá, ${firstName}!</p>
      <p>Um novo formulário foi atribuído à sua conta e está aguardando seu preenchimento:</p>
      <div style="background:${BRAND_COLORS.creme}; border-left:4px solid ${BRAND_COLORS.tangerina}; border-radius:0 8px 8px 0; padding:14px 18px; margin:18px 0;">
        <div style="font-size:16px; font-weight:bold; color:${BRAND_COLORS.verde};">${esc(formTitle)}</div>
        <div style="font-size:13px; color:${BRAND_COLORS.textMuted}; margin-top:4px;">Acesse o hub para preencher</div>
      </div>
      ${credentialsBlock}
      <p style="font-size:13px; color:${BRAND_COLORS.textMuted};">Dúvidas? Entre em contato com nossa equipe.</p>
    `;

    const subject = tempPassword
      ? `Carreira U.S.A. — Sua conta está pronta e há um formulário aguardando`
      : `Carreira U.S.A. — Novo formulário para preencher`;

    const html = renderBaseLayout({
      title: 'Formulário aguardando preenchimento',
      preheader: subject,
      bodyHtml,
      ctaLabel: 'Acessar portal',
      ctaUrl: portalUrl,
      footerNote: 'Não responda este e-mail',
    });

    await this.sendEmailWithTracking(
      customer.email,
      subject,
      html,
      NotificationType.HUB_WELCOME,
      { customerId: customer.id }
    );
  }
}

// ---------------------------------------------------------------------------
// Singleton exports (backward compatible)
// ---------------------------------------------------------------------------

export const emailService = new EmailService();

/** @deprecated Use emailService directly. Alias kept for backward compatibility. */
export const notificationService = emailService;

/** @deprecated Use EmailService directly. Alias kept for backward compatibility. */
export { EmailService as NotificationService };
