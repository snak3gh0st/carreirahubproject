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

export interface AdminDigestData {
  weekRange: string;
  mrr: { current: number; deltaWeek: number; deltaPercent: number };
  dealsAtRisk: Array<{ title: string; value: number; ownerName: string; lastActivityDays: number }>;
  cfoInsights: string;
  conversionFunnel: { leads: number; qualified: number; deals: number; won: number };
  leadSourcePerformance: Array<{ source: string; leads: number; conversions: number }>;
  biHighlights: string[];
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

        await prisma.notification.create({
          data: {
            type,
            status: NotificationStatus.PENDING,
            recipient: to,
            subject,
            templateId: type,
            errorMessage: 'RESEND_API_KEY not configured',
            invoiceId: relations.invoiceId,
            contractId: relations.contractId,
            customerId: relations.customerId,
          },
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

      await prisma.notification.create({
        data: {
          type,
          status: NotificationStatus.SENT,
          recipient: to,
          subject,
          templateId: type,
          sentAt: new Date(),
          invoiceId: relations.invoiceId,
          contractId: relations.contractId,
          customerId: relations.customerId,
        },
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

        await prisma.notification.create({
          data: {
            type,
            status: NotificationStatus.PENDING,
            recipient: to,
            subject,
            templateId: type,
            errorMessage: `Circuit breaker open: ${error.message}. Email will be retried when service recovers.`,
            invoiceId: relations.invoiceId,
            contractId: relations.contractId,
            customerId: relations.customerId,
          },
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

      await prisma.notification.create({
        data: {
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
        },
      });

      throw error;
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
}

// ---------------------------------------------------------------------------
// Singleton exports (backward compatible)
// ---------------------------------------------------------------------------

export const emailService = new EmailService();

/** @deprecated Use emailService directly. Alias kept for backward compatibility. */
export const notificationService = emailService;

/** @deprecated Use EmailService directly. Alias kept for backward compatibility. */
export { EmailService as NotificationService };
