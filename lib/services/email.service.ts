/**
 * Email Service
 *
 * Handles sending emails via Resend API for:
 * - Overdue invoice notifications
 * - Daily task digests
 * - AR aging reports
 * - Collection reminders
 * - Stale invoice alerts
 *
 * Configuration:
 * - RESEND_API_KEY: API key from resend.com
 * - EMAIL_FROM: Sender email (must be verified domain)
 */

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
    type: "collection_call" | "follow_up" | "escalate" | "review";
    priority: "high" | "medium" | "low";
    description: string;
    invoiceNumber?: string;
    customerName?: string;
  }>;
}

export class EmailService {
  private apiKey: string;
  private fromEmail: string;
  private enabled: boolean;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY || "";
    this.fromEmail = process.env.EMAIL_FROM || "noreply@carreirausahub.com";
    this.enabled = !!this.apiKey;

    if (!this.enabled) {
      console.warn(
        "[EmailService] RESEND_API_KEY not configured. Emails will not be sent."
      );
    }
  }

  /**
   * Send email via Resend API
   */
  private async sendEmail(template: EmailTemplate): Promise<boolean> {
    if (!this.enabled) {
      console.log(
        `[EmailService] Email not sent (disabled): ${template.subject} to ${template.to}`
      );
      return false;
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: Array.isArray(template.to) ? template.to : [template.to],
          subject: template.subject,
          html: template.html,
          text: template.text,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("[EmailService] Failed to send email:", error);
        return false;
      }

      const data = await response.json();
      console.log(`[EmailService] Email sent successfully:`, data.id);
      return true;
    } catch (error) {
      console.error("[EmailService] Error sending email:", error);
      return false;
    }
  }

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
      <h1 style="margin: 0;">⚠️ Faturas em Atraso</h1>
    </div>
    <div class="content">
      <p>Olá <strong>${data.userName}</strong>,</p>
      <p>Você tem <strong>${data.invoices.length} fatura(s)</strong> em atraso totalizando <strong>$${totalAmount.toFixed(2)}</strong>.</p>

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
              <td>${new Date(inv.dueDate).toLocaleDateString("pt-BR")}</td>
              <td class="overdue">${inv.daysOverdue} dias</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>

      <p><strong>Ação necessária:</strong> Por favor, entre em contato com os clientes para resolver essas pendências.</p>
      <p>
        <a href="${process.env.NEXTAUTH_URL}/dashboard/invoices?status=OVERDUE"
           style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
          Ver Faturas em Atraso
        </a>
      </p>
    </div>
    <div class="footer">
      <p>Carreira USA Hub - Sistema de Gestão Financeira</p>
      <p>Este é um email automático. Não responda.</p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({
      to: email,
      subject: `⚠️ ${data.invoices.length} Fatura(s) em Atraso - Ação Necessária`,
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
      high: "#dc2626",
      medium: "#f59e0b",
      low: "#3b82f6",
    };

    const priorityLabel = {
      high: "Alta",
      medium: "Média",
      low: "Baixa",
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
      <h1 style="margin: 0;">📊 Resumo Diário - Contas a Receber</h1>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">${new Date().toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
    </div>
    <div class="content">
      <p>Olá <strong>${data.userName}</strong>,</p>
      <p>Aqui está seu resumo diário de contas a receber:</p>

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
        <h2 style="margin-top: 0;">📋 Tarefas do Dia</h2>
        ${data.tasks
          .map(
            (task) => `
          <div class="task task-${task.priority}">
            <span class="task-priority" style="background: ${priorityColor[task.priority]}">
              ${priorityLabel[task.priority]}
            </span>
            <p style="margin: 8px 0 0 0;"><strong>${task.description}</strong></p>
            ${task.customerName ? `<p style="margin: 5px 0 0 0; font-size: 13px; color: #6b7280;">Cliente: ${task.customerName}</p>` : ""}
            ${task.invoiceNumber ? `<p style="margin: 3px 0 0 0; font-size: 13px; color: #6b7280;">Fatura: ${task.invoiceNumber}</p>` : ""}
          </div>
        `
          )
          .join("")}
      </div>
      `
          : ""
      }

      <p>
        <a href="${process.env.NEXTAUTH_URL}/dashboard/insights"
           style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
          Ver Dashboard Completo
        </a>
      </p>
    </div>
    <div class="footer">
      <p>Carreira USA Hub - Sistema de Gestão Financeira</p>
      <p>Este é um email automático. Não responda.</p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({
      to: email,
      subject: `📊 Resumo Diário - ${data.summary.overdueInvoices} Fatura(s) em Atraso`,
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
      <h1 style="margin: 0;">⏰ Faturas Antigas para Revisão</h1>
    </div>
    <div class="content">
      <p>Olá <strong>${userName}</strong>,</p>
      <p>Você tem <strong>${invoices.length} fatura(s)</strong> com mais de 180 dias em atraso, totalizando <strong>$${totalAmount.toFixed(2)}</strong>.</p>
      <p style="background: #fef3c7; padding: 12px; border-left: 4px solid #f59e0b; border-radius: 4px;">
        <strong>⚠️ Ação Necessária:</strong> Estas faturas devem ser revisadas para write-off ou encaminhadas para cobrança legal.
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
            .join("")}
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
      <p>Carreira USA Hub - Sistema de Gestão Financeira</p>
      <p>Este é um email automático. Não responda.</p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({
      to: email,
      subject: `⏰ ${invoices.length} Fatura(s) Antiga(s) para Revisão (180+ dias)`,
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
    const isPt = data.locale === "pt-BR" || data.locale === "pt";
    const firstName = data.customerName.split(" ")[0];

    const html = isPt ? `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 40px 0;">
  <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="background: #2F443F; padding: 40px 40px 32px; text-align: center;">
      <h1 style="color: #FFF8E8; font-size: 26px; margin: 0; font-weight: 700;">Bem-vindo(a) à Carreira USA</h1>
      <p style="color: rgba(255,248,232,0.7); margin: 8px 0 0; font-size: 15px;">Seu portal do cliente está pronto</p>
    </div>
    <div style="padding: 36px 40px;">
      <p style="color: #2F443F; font-size: 16px; margin: 0 0 20px;">Olá, ${firstName}!</p>
      <p style="color: #444; font-size: 15px; line-height: 1.6; margin: 0 0 28px;">
        Sua conta foi criada com sucesso. Use as credenciais abaixo para acessar seu portal e finalizar o pagamento da sua fatura.
      </p>
      <div style="background: #FFF8E8; border: 1px solid #E1C19B; border-radius: 12px; padding: 24px; margin-bottom: 28px;">
        <p style="margin: 0 0 8px; font-size: 13px; color: #6B6358; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Seu acesso temporário</p>
        <p style="margin: 0 0 4px; font-size: 15px; color: #2F443F;"><strong>E-mail:</strong> ${data.email}</p>
        <p style="margin: 0; font-size: 15px; color: #2F443F;"><strong>Senha temporária:</strong> <span style="font-family: monospace; background: #fff; padding: 2px 8px; border-radius: 4px; border: 1px solid #E1C19B;">${data.tempPassword}</span></p>
      </div>
      <p style="color: #666; font-size: 13px; margin: 0 0 28px;">Você será solicitado(a) a criar uma senha definitiva no primeiro acesso.</p>
      <div style="text-align: center;">
        <a href="${data.loginUrl}" style="display: inline-block; background: #FF8142; color: #fff; font-weight: 700; font-size: 16px; padding: 14px 40px; border-radius: 12px; text-decoration: none;">Acessar Portal →</a>
      </div>
    </div>
    <div style="border-top: 1px solid #f0ebe3; padding: 20px 40px; text-align: center;">
      <p style="color: #aaa; font-size: 12px; margin: 0;">Carreira USA · carreirausa.com</p>
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
        <a href="${data.loginUrl}" style="display: inline-block; background: #FF8142; color: #fff; font-weight: 700; font-size: 16px; padding: 14px 40px; border-radius: 12px; text-decoration: none;">Access Portal →</a>
      </div>
    </div>
    <div style="border-top: 1px solid #f0ebe3; padding: 20px 40px; text-align: center;">
      <p style="color: #aaa; font-size: 12px; margin: 0;">Carreira USA · carreirausa.com</p>
    </div>
  </div>
</body>
</html>`;

    return this.sendEmail({
      to: data.email,
      subject: isPt
        ? "Bem-vindo(a) à Carreira USA — Acesse seu portal"
        : "Welcome to Carreira USA — Access your portal",
      html,
    });
  }
}

// Export singleton
export const emailService = new EmailService();
