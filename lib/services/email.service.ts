/**
 * Email Service (Consolidated)
 *
 * Single source of truth for ALL email sending in the application.
 * Uses Resend SDK with circuit breaker protection and DB logging.
 *
 * Consolidates:
 * - Financial templates (overdue alerts, daily digest, stale invoices, welcome)
 * - Contract templates (signature request, signed, expired)
 * - Payment templates (payment link, reminder, received)
 * - Hub templates (welcome, invoice available, password reset)
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
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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

  /**
   * Internal method to send email via Resend with circuit breaker and DB logging.
   *
   * Used by notification/contract/hub templates that have a matching
   * NotificationType enum value.
   */
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
    const startTime = Date.now();
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
   * Lightweight send for financial templates that have no matching
   * NotificationType enum value.  Still uses Resend SDK + circuit breaker,
   * but skips DB notification logging.
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
  // Financial templates (from original email.service.ts)
  // =========================================================================

  /**
   * Send overdue invoice notification
   */
  async sendOverdueInvoiceAlert(
    email: string,
    data: OverdueInvoiceEmail
  ): Promise<boolean> {
    const totalAmount = data.invoices.reduce((sum, inv) => sum + inv.amount, 0);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; }
    .invoice-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; }
    .invoice-table th { background: #f3f4f6; padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; }
    .invoice-table td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
    .overdue { color: #dc2626; font-weight: bold; }
    .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Faturas em Atraso</h1>
    </div>
    <div class="content">
      <p>Ola <strong>${data.userName}</strong>,</p>
      <p>Voce tem <strong>${data.invoices.length} fatura(s)</strong> em atraso totalizando <strong>$${totalAmount.toFixed(2)}</strong>.</p>

      <table class="invoice-table">
        <thead>
          <tr>
            <th>Fatura</th>
            <th>Cliente</th>
            <th>Valor</th>
            <th>Vencimento</th>
            <th>Dias em Atraso</th>
          </tr>
        </thead>
        <tbody>
          ${data.invoices
            .map(
              (inv) => `
            <tr>
              <td>${inv.invoiceNumber}</td>
              <td>${inv.customerName}</td>
              <td>$${inv.amount.toFixed(2)}</td>
              <td>${new Date(inv.dueDate).toLocaleDateString('pt-BR')}</td>
              <td class="overdue">${inv.daysOverdue} dias</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      <p><strong>Acao necessaria:</strong> Por favor, entre em contato com os clientes para resolver essas pendencias.</p>
      <p>
        <a href="${process.env.NEXTAUTH_URL}/dashboard/invoices?status=OVERDUE"
           style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
          Ver Faturas em Atraso
        </a>
      </p>
    </div>
    <div class="footer">
      <p>Carreira USA Hub - Sistema de Gestao Financeira</p>
      <p>Este e um email automatico. Nao responda.</p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmailSimple({
      to: email,
      subject: `${data.invoices.length} Fatura(s) em Atraso - Acao Necessaria`,
      html,
    });
  }

  /**
   * Send daily digest email
   */
  async sendDailyDigest(
    email: string,
    data: DailyDigestEmail
  ): Promise<boolean> {
    const priorityColor = {
      high: '#dc2626',
      medium: '#f59e0b',
      low: '#3b82f6',
    };

    const priorityLabel = {
      high: 'Alta',
      medium: 'Media',
      low: 'Baixa',
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #6366f1; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; }
    .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
    .summary-card { background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #6366f1; }
    .summary-card h3 { margin: 0 0 5px 0; font-size: 14px; color: #6b7280; }
    .summary-card .value { font-size: 24px; font-weight: bold; color: #111827; }
    .summary-card .amount { font-size: 12px; color: #6b7280; }
    .tasks-section { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .task { padding: 12px; margin: 8px 0; border-left: 4px solid #e5e7eb; background: #f9fafb; border-radius: 4px; }
    .task-high { border-left-color: #dc2626; }
    .task-medium { border-left-color: #f59e0b; }
    .task-low { border-left-color: #3b82f6; }
    .task-priority { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; color: white; }
    .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Resumo Diario - Contas a Receber</h1>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">${new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
    <div class="content">
      <p>Ola <strong>${data.userName}</strong>,</p>
      <p>Aqui esta seu resumo diario de contas a receber:</p>

      <div class="summary-grid">
        <div class="summary-card" style="border-left-color: #dc2626;">
          <h3>Faturas em Atraso</h3>
          <div class="value">${data.summary.overdueInvoices}</div>
          <div class="amount">$${data.summary.overdueAmount.toFixed(2)}</div>
        </div>

        <div class="summary-card" style="border-left-color: #f59e0b;">
          <h3>Faturas em Risco</h3>
          <div class="value">${data.summary.atRiskInvoices}</div>
          <div class="amount">$${data.summary.atRiskAmount.toFixed(2)}</div>
        </div>

        <div class="summary-card" style="border-left-color: #fb923c;">
          <h3>Faturas Antigas</h3>
          <div class="value">${data.summary.staleInvoices}</div>
          <div class="amount">$${data.summary.staleAmount.toFixed(2)}</div>
        </div>
      </div>

      ${
        data.tasks.length > 0
          ? `
      <div class="tasks-section">
        <h2 style="margin-top: 0;">Tarefas do Dia</h2>
        ${data.tasks
          .map(
            (task) => `
          <div class="task task-${task.priority}">
            <span class="task-priority" style="background: ${priorityColor[task.priority]}">
              ${priorityLabel[task.priority]}
            </span>
            <p style="margin: 8px 0 0 0;"><strong>${task.description}</strong></p>
            ${task.customerName ? `<p style="margin: 5px 0 0 0; font-size: 13px; color: #6b7280;">Cliente: ${task.customerName}</p>` : ''}
            ${task.invoiceNumber ? `<p style="margin: 3px 0 0 0; font-size: 13px; color: #6b7280;">Fatura: ${task.invoiceNumber}</p>` : ''}
          </div>
        `
          )
          .join('')}
      </div>
      `
          : ''
      }

      <p>
        <a href="${process.env.NEXTAUTH_URL}/dashboard/insights"
           style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
          Ver Dashboard Completo
        </a>
      </p>
    </div>
    <div class="footer">
      <p>Carreira USA Hub - Sistema de Gestao Financeira</p>
      <p>Este e um email automatico. Nao responda.</p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmailSimple({
      to: email,
      subject: `Resumo Diario - ${data.summary.overdueInvoices} Fatura(s) em Atraso`,
      html,
    });
  }

  /**
   * Send stale invoice alert (for write-off review)
   */
  async sendStaleInvoiceAlert(
    email: string,
    userName: string,
    invoices: Array<{
      invoiceNumber: string;
      customerName: string;
      amount: number;
      daysOverdue: number;
    }>
  ): Promise<boolean> {
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #fb923c; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; }
    .invoice-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; }
    .invoice-table th { background: #f3f4f6; padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; }
    .invoice-table td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
    .critical { color: #dc2626; font-weight: bold; }
    .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Faturas Antigas para Revisao</h1>
    </div>
    <div class="content">
      <p>Ola <strong>${userName}</strong>,</p>
      <p>Voce tem <strong>${invoices.length} fatura(s)</strong> com mais de 180 dias em atraso, totalizando <strong>$${totalAmount.toFixed(2)}</strong>.</p>
      <p style="background: #fef3c7; padding: 12px; border-left: 4px solid #f59e0b; border-radius: 4px;">
        <strong>Acao Necessaria:</strong> Estas faturas devem ser revisadas para write-off ou encaminhadas para cobranca legal.
      </p>

      <table class="invoice-table">
        <thead>
          <tr>
            <th>Fatura</th>
            <th>Cliente</th>
            <th>Valor</th>
            <th>Dias em Atraso</th>
          </tr>
        </thead>
        <tbody>
          ${invoices
            .map(
              (inv) => `
            <tr>
              <td>${inv.invoiceNumber}</td>
              <td>${inv.customerName}</td>
              <td>$${inv.amount.toFixed(2)}</td>
              <td class="critical">${inv.daysOverdue} dias</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      <p>
        <a href="${process.env.NEXTAUTH_URL}/dashboard/insights"
           style="display: inline-block; background: #fb923c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
          Ver Faturas Antigas
        </a>
      </p>
    </div>
    <div class="footer">
      <p>Carreira USA Hub - Sistema de Gestao Financeira</p>
      <p>Este e um email automatico. Nao responda.</p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmailSimple({
      to: email,
      subject: `${invoices.length} Fatura(s) Antiga(s) para Revisao (180+ dias)`,
      html,
    });
  }

  /**
   * Send welcome email with temporary password to new hub user
   */
  async sendWelcomeWithTempPassword(data: {
    customerName: string;
    email: string;
    tempPassword: string;
    loginUrl: string;
    locale?: string;
  }): Promise<boolean> {
    const isPt = data.locale === 'pt-BR' || data.locale === 'pt';
    const firstName = data.customerName.split(' ')[0];

    const html = isPt ? `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 40px 0;">
  <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="background: #2F443F; padding: 40px 40px 32px; text-align: center;">
      <h1 style="color: #FFF8E8; font-size: 26px; margin: 0; font-weight: 700;">Bem-vindo(a) a Carreira USA</h1>
      <p style="color: rgba(255,248,232,0.7); margin: 8px 0 0; font-size: 15px;">Seu portal do cliente esta pronto</p>
    </div>
    <div style="padding: 36px 40px;">
      <p style="color: #2F443F; font-size: 16px; margin: 0 0 20px;">Ola, ${firstName}!</p>
      <p style="color: #444; font-size: 15px; line-height: 1.6; margin: 0 0 28px;">
        Sua conta foi criada com sucesso. Use as credenciais abaixo para acessar seu portal e finalizar o pagamento da sua fatura.
      </p>
      <div style="background: #FFF8E8; border: 1px solid #E1C19B; border-radius: 12px; padding: 24px; margin-bottom: 28px;">
        <p style="margin: 0 0 8px; font-size: 13px; color: #6B6358; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Seu acesso temporario</p>
        <p style="margin: 0 0 4px; font-size: 15px; color: #2F443F;"><strong>E-mail:</strong> ${data.email}</p>
        <p style="margin: 0; font-size: 15px; color: #2F443F;"><strong>Senha temporaria:</strong> <span style="font-family: monospace; background: #fff; padding: 2px 8px; border-radius: 4px; border: 1px solid #E1C19B;">${data.tempPassword}</span></p>
      </div>
      <p style="color: #666; font-size: 13px; margin: 0 0 28px;">Voce sera solicitado(a) a criar uma senha definitiva no primeiro acesso.</p>
      <div style="text-align: center;">
        <a href="${data.loginUrl}" style="display: inline-block; background: #FF8142; color: #fff; font-weight: 700; font-size: 16px; padding: 14px 40px; border-radius: 12px; text-decoration: none;">Acessar Portal</a>
      </div>
    </div>
    <div style="border-top: 1px solid #f0ebe3; padding: 20px 40px; text-align: center;">
      <p style="color: #aaa; font-size: 12px; margin: 0;">Carreira USA - carreirausa.com</p>
    </div>
  </div>
</body>
</html>` : `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 40px 0;">
  <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="background: #2F443F; padding: 40px 40px 32px; text-align: center;">
      <h1 style="color: #FFF8E8; font-size: 26px; margin: 0; font-weight: 700;">Welcome to Carreira USA</h1>
      <p style="color: rgba(255,248,232,0.7); margin: 8px 0 0; font-size: 15px;">Your client portal is ready</p>
    </div>
    <div style="padding: 36px 40px;">
      <p style="color: #2F443F; font-size: 16px; margin: 0 0 20px;">Hi, ${firstName}!</p>
      <p style="color: #444; font-size: 15px; line-height: 1.6; margin: 0 0 28px;">
        Your account has been created. Use the credentials below to access your portal and complete your invoice payment.
      </p>
      <div style="background: #FFF8E8; border: 1px solid #E1C19B; border-radius: 12px; padding: 24px; margin-bottom: 28px;">
        <p style="margin: 0 0 8px; font-size: 13px; color: #6B6358; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Your temporary access</p>
        <p style="margin: 0 0 4px; font-size: 15px; color: #2F443F;"><strong>Email:</strong> ${data.email}</p>
        <p style="margin: 0; font-size: 15px; color: #2F443F;"><strong>Temporary password:</strong> <span style="font-family: monospace; background: #fff; padding: 2px 8px; border-radius: 4px; border: 1px solid #E1C19B;">${data.tempPassword}</span></p>
      </div>
      <p style="color: #666; font-size: 13px; margin: 0 0 28px;">You will be asked to set a permanent password on first login.</p>
      <div style="text-align: center;">
        <a href="${data.loginUrl}" style="display: inline-block; background: #FF8142; color: #fff; font-weight: 700; font-size: 16px; padding: 14px 40px; border-radius: 12px; text-decoration: none;">Access Portal</a>
      </div>
    </div>
    <div style="border-top: 1px solid #f0ebe3; padding: 20px 40px; text-align: center;">
      <p style="color: #aaa; font-size: 12px; margin: 0;">Carreira USA - carreirausa.com</p>
    </div>
  </div>
</body>
</html>`;

    return this.sendEmailSimple({
      to: data.email,
      subject: isPt
        ? 'Bem-vindo(a) a Carreira USA -- Acesse seu portal'
        : 'Welcome to Carreira USA -- Access your portal',
      html,
    });
  }

  // =========================================================================
  // Contract templates (from notification.service.ts)
  // =========================================================================

  /**
   * Send contract for signature to client
   */
  async sendContractForSignature(contract: Contract, customer: Customer, invoiceNumber: string): Promise<void> {
    const subject = `CarreiraUSA - Contract Ready for Signature`;
    const html = this.generateContractSignatureRequestEmail(contract, customer, invoiceNumber);

    await this.sendEmailWithTracking(
      customer.email,
      subject,
      html,
      NotificationType.CONTRACT_SENT,
      { contractId: contract.id, customerId: customer.id }
    );
  }

  /**
   * Send contract signed notification to finance team
   */
  async sendContractSigned(contract: Contract, customer: Customer): Promise<void> {
    const subject = `Contract Signed - ${customer.name}`;
    const html = this.generateContractSignedEmail(contract, customer);

    await this.sendEmailWithTracking(
      EMAIL_FINANCE_TEAM,
      subject,
      html,
      NotificationType.CONTRACT_SIGNED,
      { contractId: contract.id, customerId: customer.id }
    );
  }

  /**
   * Send contract expired notification to finance team
   */
  async sendContractExpired(contract: Contract, customer: Customer): Promise<void> {
    const subject = `Contract Expired - ${customer.name}`;
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
  // Payment templates (from notification.service.ts)
  // =========================================================================

  /**
   * Send payment link to client after contract signing
   */
  async sendPaymentLink(invoice: Invoice, customer: Customer, paymentUrl: string): Promise<void> {
    const subject = `CarreiraUSA - Payment for Invoice ${invoice.invoiceNumber || invoice.id}`;
    const html = this.generatePaymentLinkEmail(invoice, customer, paymentUrl);

    await this.sendEmailWithTracking(
      customer.email,
      subject,
      html,
      NotificationType.PAYMENT_LINK_SENT,
      { invoiceId: invoice.id, customerId: customer.id }
    );
  }

  /**
   * Send payment reminder to client
   */
  async sendPaymentReminder(invoice: Invoice, customer: Customer, paymentUrl: string): Promise<void> {
    const daysUntilDue = Math.ceil((invoice.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const subject = `Payment Reminder - Invoice ${invoice.invoiceNumber || invoice.id} Due in ${daysUntilDue} Days`;
    const html = this.generatePaymentReminderEmail(invoice, customer, paymentUrl, daysUntilDue);

    await this.sendEmailWithTracking(
      customer.email,
      subject,
      html,
      NotificationType.PAYMENT_REMINDER,
      { invoiceId: invoice.id, customerId: customer.id }
    );
  }

  /**
   * Send payment received confirmation to client and finance team
   */
  async sendPaymentReceived(invoice: Invoice, customer: Customer): Promise<void> {
    const subject = `Payment Received - Invoice ${invoice.invoiceNumber || invoice.id}`;
    const htmlCustomer = this.generatePaymentReceivedEmail(invoice, customer);

    await this.sendEmailWithTracking(
      customer.email,
      subject,
      htmlCustomer,
      NotificationType.PAYMENT_RECEIVED,
      { invoiceId: invoice.id, customerId: customer.id }
    );

    await this.sendEmailWithTracking(
      EMAIL_FINANCE_TEAM,
      subject,
      htmlCustomer,
      NotificationType.PAYMENT_RECEIVED,
      { invoiceId: invoice.id, customerId: customer.id }
    );
  }

  // =========================================================================
  // Hub templates (from notification.service.ts)
  // =========================================================================

  /**
   * Send hub welcome email with temporary password to new client user
   */
  async sendHubWelcome(customer: { id: string; email: string; name: string }, tempPassword: string): Promise<void> {
    const subject = `Welcome to Carreira U.S.A. -- Your Account is Ready`;
    const html = this.generateHubWelcomeEmail(customer, tempPassword);

    await this.sendEmailWithTracking(
      customer.email,
      subject,
      html,
      NotificationType.HUB_WELCOME,
      { customerId: customer.id }
    );
  }

  /**
   * Send notification when a new invoice is available in the hub
   */
  async sendHubInvoiceAvailable(
    customer: { id: string; email: string; name: string },
    invoice: { id: string; invoiceNumber: string | null; amount: any }
  ): Promise<void> {
    const subject = `New Invoice Available -- Carreira U.S.A.`;
    const html = this.generateHubInvoiceAvailableEmail(customer, invoice);

    await this.sendEmailWithTracking(
      customer.email,
      subject,
      html,
      NotificationType.HUB_INVOICE_AVAILABLE,
      { customerId: customer.id, invoiceId: invoice.id }
    );
  }

  /**
   * Send password reset email to client user
   */
  async sendHubPasswordReset(customer: { id: string; email: string; name: string }, resetUrl: string): Promise<void> {
    const subject = `Password Reset -- Carreira U.S.A.`;
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
  // Deprecated approval stubs
  // =========================================================================

  /**
   * @deprecated Invoice approval workflow removed in quick-012
   */
  async sendInvoiceApprovalRequest(invoice: Invoice, submitter: User): Promise<void> {
    console.warn('sendInvoiceApprovalRequest called but approval workflow has been removed');
  }

  /**
   * @deprecated Invoice approval workflow removed in quick-012
   */
  async sendInvoiceApproved(invoice: Invoice, approver: User): Promise<void> {
    console.warn('sendInvoiceApproved called but approval workflow has been removed');
  }

  /**
   * @deprecated Invoice approval workflow removed in quick-012
   */
  async sendInvoiceRejected(invoice: Invoice, rejector: User, reason: string): Promise<void> {
    console.warn('sendInvoiceRejected called but approval workflow has been removed');
  }

  // =========================================================================
  // Commercial notification (from notification.service.ts)
  // =========================================================================

  /**
   * Notify commercial user when contract is signed
   */
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
  // Private HTML template generators (from notification.service.ts)
  // =========================================================================

  private generateContractSignatureRequestEmail(contract: Contract, customer: Customer, invoiceNumber: string): string {
    const docusignUrl = contract.docusign_env_id
      ? `https://app.docusign.com/documents/details/${contract.docusign_env_id}`
      : `${APP_URL}/contract/${contract.id}`;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Contract Ready for Signature</h1>
            </div>
            <div class="content">
              <p>Dear ${customer.name},</p>
              <p>Your service agreement is ready for signature. Please review and sign the contract to proceed with payment.</p>

              <div class="details">
                <h3>Contract Information</h3>
                <p><strong>Invoice:</strong> ${invoiceNumber}</p>
                <p><strong>Recipient:</strong> ${customer.name}</p>
                <p><strong>Email:</strong> ${customer.email}</p>
              </div>

              <div style="text-align: center;">
                <a href="${docusignUrl}" class="button">Review & Sign Contract</a>
              </div>

              <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
                <strong>Important:</strong> This contract will expire in 30 days. Please sign it as soon as possible to avoid delays.
              </p>

              <p>If you have any questions, please contact our support team.</p>
            </div>
            <div class="footer">
              <p>CarreiraUSA - Professional Services</p>
              <p>This is an automated message from DocuSign</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generateContractSignedEmail(contract: Contract, customer: Customer): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10b981; color: white; padding: 20px; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .success { color: #10b981; font-size: 48px; text-align: center; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Contract Signed Successfully</h1>
            </div>
            <div class="content">
              <div class="success">&#10003;</div>
              <p>Hello Finance Team,</p>
              <p>Great news! The contract has been signed by the client.</p>

              <p><strong>Client:</strong> ${customer.name} (${customer.email})</p>
              <p><strong>Signed At:</strong> ${new Date().toLocaleString()}</p>

              <p><strong>Next Steps:</strong></p>
              <ul>
                <li>Payment link will be automatically sent to the client</li>
                <li>Monitor payment status in the dashboard</li>
              </ul>
            </div>
            <div class="footer">
              <p>CarreiraUSA Hub - Automated Notification</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generateContractExpiredEmail(contract: Contract, customer: Customer): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #ef4444; color: white; padding: 20px; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Contract Expired</h1>
            </div>
            <div class="content">
              <p>Hello Finance Team,</p>
              <p>A contract has expired without being signed.</p>

              <p><strong>Client:</strong> ${customer.name} (${customer.email})</p>
              <p><strong>Sent:</strong> ${contract.sentAt ? new Date(contract.sentAt).toLocaleDateString() : 'N/A'}</p>
              <p><strong>Expired:</strong> ${contract.expiresAt ? new Date(contract.expiresAt).toLocaleDateString() : 'N/A'}</p>
              <p><strong>Reminders Sent:</strong> ${contract.reminderCount}</p>

              <p>Please follow up with the client to understand the reason and resend if necessary.</p>
            </div>
            <div class="footer">
              <p>CarreiraUSA Hub - Automated Notification</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generatePaymentLinkEmail(invoice: Invoice, customer: Customer, paymentUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .button { display: inline-block; background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; font-size: 16px; }
            .details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
            .amount { font-size: 32px; color: #2563eb; font-weight: bold; text-align: center; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Payment Link Ready</h1>
            </div>
            <div class="content">
              <p>Dear ${customer.name},</p>
              <p>Thank you for signing the contract! You can now proceed with the payment.</p>

              <div class="details">
                <h3>Invoice Details</h3>
                <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber || invoice.id}</p>
                <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
                <div class="amount">$${Number(invoice.amount).toFixed(2)}</div>
              </div>

              <div style="text-align: center;">
                <a href="${paymentUrl}" class="button">Pay Now</a>
              </div>

              <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
                <strong>Payment Methods Accepted:</strong><br>
                Credit Card - Debit Card - ACH Transfer
              </p>

              <p style="color: #6b7280; font-size: 14px;">
                You will receive a payment confirmation once the transaction is complete.
              </p>
            </div>
            <div class="footer">
              <p>CarreiraUSA - Professional Services</p>
              <p>Secure payments powered by QuickBooks</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generatePaymentReminderEmail(invoice: Invoice, customer: Customer, paymentUrl: string, daysUntilDue: number): string {
    const urgency = daysUntilDue <= 1 ? 'urgent' : 'normal';
    const headerColor = urgency === 'urgent' ? '#ef4444' : '#f59e0b';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${headerColor}; color: white; padding: 20px; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .button { display: inline-block; background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .warning { background: #fef3c7; border-left: 4px solid ${headerColor}; padding: 15px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${urgency === 'urgent' ? 'URGENT: ' : ''}Payment Reminder</h1>
            </div>
            <div class="content">
              <p>Dear ${customer.name},</p>
              <p>This is a ${urgency === 'urgent' ? 'final' : 'friendly'} reminder about your pending payment.</p>

              <div class="warning">
                <h4>Due in ${daysUntilDue} ${daysUntilDue === 1 ? 'Day' : 'Days'}</h4>
                <p><strong>Invoice:</strong> ${invoice.invoiceNumber || invoice.id}</p>
                <p><strong>Amount:</strong> $${Number(invoice.amount).toFixed(2)}</p>
                <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
              </div>

              <div style="text-align: center;">
                <a href="${paymentUrl}" class="button">Pay Now</a>
              </div>

              <p style="margin-top: 20px;">
                Please process this payment as soon as possible to avoid any service interruptions.
              </p>

              <p>If you have already made the payment, please disregard this message.</p>
            </div>
            <div class="footer">
              <p>CarreiraUSA - Professional Services</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generatePaymentReceivedEmail(invoice: Invoice, customer: Customer): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10b981; color: white; padding: 20px; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .success { color: #10b981; font-size: 48px; text-align: center; margin: 20px 0; }
            .details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Payment Received Successfully</h1>
            </div>
            <div class="content">
              <div class="success">&#10003;</div>
              <p>Dear ${customer.name},</p>
              <p>Thank you! Your payment has been received and processed successfully.</p>

              <div class="details">
                <h3>Payment Confirmation</h3>
                <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber || invoice.id}</p>
                <p><strong>Amount Paid:</strong> $${Number(invoice.amount).toFixed(2)}</p>
                <p><strong>Payment Date:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Status:</strong> PAID</p>
              </div>

              <p>A receipt has been sent to your email address. You can also view this invoice in your customer portal.</p>

              <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
                If you have any questions about this payment, please contact our support team.
              </p>
            </div>
            <div class="footer">
              <p>CarreiraUSA - Professional Services</p>
              <p>Thank you for your business!</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generateHubWelcomeEmail(customer: { name: string; email: string }, tempPassword: string): string {
    const portalUrl = `${process.env.NEXTAUTH_URL || APP_URL}/hub/login`;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #FF8142; color: white; padding: 20px; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .button { display: inline-block; background: #FF8142; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .credentials { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border: 1px solid #e5e7eb; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Carreira U.S.A.</h1>
            </div>
            <div class="content">
              <p>Dear ${customer.name},</p>
              <p>Your client portal is ready. You can now access your invoices, contracts, and account information in one place.</p>

              <div class="credentials">
                <h3>Your Login Credentials</h3>
                <p><strong>Portal:</strong> <a href="${portalUrl}">${portalUrl}</a></p>
                <p><strong>Email:</strong> ${customer.email}</p>
                <p><strong>Temporary Password:</strong> ${tempPassword}</p>
              </div>

              <div class="warning">
                <p><strong>Important:</strong> Please change your password on first login. Your temporary password expires in 24 hours.</p>
              </div>

              <div style="text-align: center;">
                <a href="${portalUrl}" class="button">Access Your Portal</a>
              </div>

              <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
                If you have any questions, please contact our support team.
              </p>
            </div>
            <div class="footer">
              <p>Carreira U.S.A. - Professional Services</p>
              <p>Do not reply to this email</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generateHubInvoiceAvailableEmail(
    customer: { name: string; email: string },
    invoice: { id: string; invoiceNumber: string | null; amount: any }
  ): string {
    const portalUrl = `${process.env.NEXTAUTH_URL || APP_URL}/hub/login`;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #FF8142; color: white; padding: 20px; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .button { display: inline-block; background: #FF8142; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border: 1px solid #e5e7eb; }
            .amount { font-size: 28px; color: #FF8142; font-weight: bold; text-align: center; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Invoice Available</h1>
            </div>
            <div class="content">
              <p>Dear ${customer.name},</p>
              <p>A new invoice has been issued to your account and is available for review in your client portal.</p>

              <div class="details">
                <h3>Invoice Details</h3>
                <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber || invoice.id}</p>
                <div class="amount">$${Number(invoice.amount).toFixed(2)}</div>
              </div>

              <p>Access your portal to view the full invoice details and make a payment.</p>

              <div style="text-align: center;">
                <a href="${portalUrl}" class="button">View Invoice in Portal</a>
              </div>

              <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
                If you have any questions about this invoice, please contact our support team.
              </p>
            </div>
            <div class="footer">
              <p>Carreira U.S.A. - Professional Services</p>
              <p>Do not reply to this email</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generateHubPasswordResetEmail(customer: { name: string; email: string }, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #FF8142; color: white; padding: 20px; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .button { display: inline-block; background: #FF8142; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; }
            .security { background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset</h1>
            </div>
            <div class="content">
              <p>Dear ${customer.name},</p>
              <p>We received a request to reset the password for your Carreira U.S.A. client portal account.</p>
              <p>Click the button below to reset your password:</p>

              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>

              <div class="warning">
                <p><strong>This link expires in 1 hour.</strong> If you did not request a password reset, you can safely ignore this email.</p>
              </div>

              <div class="security">
                <h4>Security Notice</h4>
                <p>For your protection, never share this link with anyone. Carreira U.S.A. will never ask for your password via email or phone.</p>
              </div>

              <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
                If you did not request this reset, please contact our support team immediately.
              </p>
            </div>
            <div class="footer">
              <p>Carreira U.S.A. - Professional Services</p>
              <p>Do not reply to this email</p>
            </div>
          </div>
        </body>
      </html>
    `;
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
