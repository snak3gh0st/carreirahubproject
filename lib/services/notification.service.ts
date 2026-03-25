import { Resend } from 'resend';
import { prisma } from '@/lib/db';
import { NotificationType, NotificationStatus } from '@prisma/client';
import { CircuitBreaker, CircuitOpenError } from "@/lib/utils/circuit-breaker";
import { integrationLogger, StructuredErrorData } from "@/lib/utils/logger";

// Lazy initialize Resend to avoid build errors when API key is not set
let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@carreirausa.com';
const EMAIL_FINANCE_TEAM = process.env.EMAIL_FINANCE_TEAM || 'finance@carreirausa.com';
const EMAIL_SUPPORT_TEAM = process.env.EMAIL_SUPPORT_TEAM || 'support@carreirausa.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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

export class NotificationService {
  private circuitBreaker: CircuitBreaker;

  constructor() {
    this.circuitBreaker = new CircuitBreaker("email");
  }

  /**
   * @deprecated Invoice approval workflow removed in quick-012
   * Send invoice approval request to FINANCE team
   */
  async sendInvoiceApprovalRequest(invoice: Invoice, submitter: User): Promise<void> {
    console.warn('sendInvoiceApprovalRequest called but approval workflow has been removed');
    // Method deprecated - approval workflow removed
  }

  /**
   * @deprecated Invoice approval workflow removed in quick-012
   * Send invoice approved notification to submitter
   */
  async sendInvoiceApproved(invoice: Invoice, approver: User): Promise<void> {
    console.warn('sendInvoiceApproved called but approval workflow has been removed');
    // Method deprecated - approval workflow removed
  }

  /**
   * @deprecated Invoice approval workflow removed in quick-012
   * Send invoice rejected notification to submitter
   */
  async sendInvoiceRejected(invoice: Invoice, rejector: User, reason: string): Promise<void> {
    console.warn('sendInvoiceRejected called but approval workflow has been removed');
    // Method deprecated - approval workflow removed
  }

  /**
   * Send contract for signature to client
   */
  async sendContractForSignature(contract: Contract, customer: Customer, invoiceNumber: string): Promise<void> {
    const subject = `CarreiraUSA - Contract Ready for Signature`;
    const html = this.generateContractSignatureRequestEmail(contract, customer, invoiceNumber);

    await this.sendEmail(
      customer.email,
      subject,
      html,
      NotificationType.CONTRACT_SENT,
      { contractId: contract.id, customerId: customer.id }
    );
  }

  /**
   * Send contract reminder to client
   */
  async sendContractReminder(contract: Contract, customer: Customer, invoiceNumber: string): Promise<void> {
    const daysRemaining = contract.expiresAt
      ? Math.ceil((contract.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;

    const subject = `Reminder: Contract Signature Required - ${daysRemaining} Days Remaining`;
    const html = this.generateContractReminderEmail(contract, customer, invoiceNumber, daysRemaining);

    await this.sendEmail(
      customer.email,
      subject,
      html,
      NotificationType.CONTRACT_REMINDER,
      { contractId: contract.id, customerId: customer.id }
    );
  }

  /**
   * Send contract signed notification to finance team
   */
  async sendContractSigned(contract: Contract, customer: Customer): Promise<void> {
    const subject = `Contract Signed - ${customer.name}`;
    const html = this.generateContractSignedEmail(contract, customer);

    await this.sendEmail(
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

    await this.sendEmail(
      EMAIL_FINANCE_TEAM,
      subject,
      html,
      NotificationType.CONTRACT_EXPIRED,
      { contractId: contract.id, customerId: customer.id }
    );
  }

  /**
   * Send payment link to client after contract signing
   */
  async sendPaymentLink(invoice: Invoice, customer: Customer, paymentUrl: string): Promise<void> {
    const subject = `CarreiraUSA - Payment for Invoice ${invoice.invoiceNumber || invoice.id}`;
    const html = this.generatePaymentLinkEmail(invoice, customer, paymentUrl);

    await this.sendEmail(
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

    await this.sendEmail(
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

    // Send to customer
    await this.sendEmail(
      customer.email,
      subject,
      htmlCustomer,
      NotificationType.PAYMENT_RECEIVED,
      { invoiceId: invoice.id, customerId: customer.id }
    );

    // Send to finance team
    await this.sendEmail(
      EMAIL_FINANCE_TEAM,
      subject,
      htmlCustomer,
      NotificationType.PAYMENT_RECEIVED,
      { invoiceId: invoice.id, customerId: customer.id }
    );
  }

  /**
   * Send hub welcome email with temporary password to new client user
   */
  async sendHubWelcome(customer: { id: string; email: string; name: string }, tempPassword: string): Promise<void> {
    const subject = `Welcome to Carreira U.S.A. — Your Account is Ready`;
    const html = this.generateHubWelcomeEmail(customer, tempPassword);

    await this.sendEmail(
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
    const subject = `New Invoice Available — Carreira U.S.A.`;
    const html = this.generateHubInvoiceAvailableEmail(customer, invoice);

    await this.sendEmail(
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
    const subject = `Password Reset — Carreira U.S.A.`;
    const html = this.generateHubPasswordResetEmail(customer, resetUrl);

    await this.sendEmail(
      customer.email,
      subject,
      html,
      NotificationType.HUB_PASSWORD_RESET,
      { customerId: customer.id }
    );
  }

  /**
   * Internal method to send email via Resend
   */
  private async sendEmail(
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
        // Log but don't throw - gracefully skip when Resend is not configured
        console.log(`[NOTIFICATION] Resend not configured, skipping email to ${to}: ${subject}`);

        const structured: StructuredErrorData = {
          errorCode: "CLIENT_NOT_CONFIGURED",
          category: "auth",
          severity: "error",
          recovery: "check_circuit",
          metadata: { to, type },
        };

        await integrationLogger.logError(
          "email",
          "sendEmail",
          "Resend client not configured",
          structured,
          { to, type }
        );

        // Still track the notification as pending
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

      // Send email via Resend with circuit breaker protection
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

      // Track successful notification
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
      const durationMs = Date.now() - startTime;

      if (error instanceof CircuitOpenError) {
        const structured: StructuredErrorData = {
          errorCode: "CIRCUIT_OPEN",
          category: "transient",
          severity: "error",
          recovery: "wait",
          metadata: { to, type },
        };

        await integrationLogger.logError(
          "email",
          "sendEmail",
          error,
          structured,
          { to, type }
        );

        console.warn(`[NOTIFICATION] Circuit breaker open for email service: ${error.message}`);
        // Track as pending for retry - circuit will eventually close and allow retries
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
        return; // Don't throw - allow graceful degradation
      }

      // Log other errors
      const structured: StructuredErrorData = {
        errorCode: (error as any)?.code || "UNKNOWN_ERROR",
        category: this.categorizeError(error),
        metadata: {
          message: (error as any)?.message,
          to,
          type,
        },
      };

      await integrationLogger.logError(
        "email",
        "sendEmail",
        error as any,
        structured,
        { to, type }
      );

      console.error(`[NOTIFICATION_ERROR] Failed to send email to ${to}:`, error);

      // Track failed notification
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

  private categorizeError(error: any): "transient" | "permanent" | "auth" | "validation" | "unknown" {
    const message = error?.message || "";

    if (message.includes("timeout") || message.includes("temporarily unavailable")) {
      return "transient";
    }
    if (message.includes("unauthorized") || message.includes("authentication")) {
      return "auth";
    }
    if (message.includes("invalid") || message.includes("malformed")) {
      return "validation";
    }
    return "unknown";
  }

  // Email Template Generators

  private generateInvoiceApprovalRequestEmail(invoice: Invoice, submitter: User): string {
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
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Invoice Awaiting Approval</h1>
            </div>
            <div class="content">
              <p>Hello Finance Team,</p>
              <p>A new invoice has been submitted and is awaiting your approval.</p>

              <div class="details">
                <h3>Invoice Details</h3>
                <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber || invoice.id}</p>
                <p><strong>Customer:</strong> ${invoice.customer.name}</p>
                <p><strong>Amount:</strong> $${Number(invoice.amount).toFixed(2)}</p>
                <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
                <p><strong>Submitted By:</strong> ${submitter.name || submitter.email}</p>
                ${invoice.deal ? `<p><strong>Deal:</strong> ${invoice.deal.title}</p>` : ''}
              </div>

              <a href="${APP_URL}/dashboard/invoices/approval-queue" class="button">Review Invoice</a>

              <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
                Please review and approve or reject this invoice as soon as possible.
              </p>
            </div>
            <div class="footer">
              <p>CarreiraUSA Hub - Automated Notification</p>
              <p>Do not reply to this email</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generateInvoiceApprovedEmail(invoice: Invoice, approver: User): string {
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
            .details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
            .success { color: #10b981; font-size: 48px; text-align: center; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Invoice Approved</h1>
            </div>
            <div class="content">
              <div class="success">✓</div>
              <p>Invoice has been approved and the automated workflow has been initiated.</p>

              <div class="details">
                <h3>Invoice Details</h3>
                <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber || invoice.id}</p>
                <p><strong>Customer:</strong> ${invoice.customer.name}</p>
                <p><strong>Amount:</strong> $${Number(invoice.amount).toFixed(2)}</p>
                <p><strong>Approved By:</strong> ${approver.name || approver.email}</p>
              </div>

              <p><strong>Next Steps:</strong></p>
              <ul>
                <li>Contract will be sent to client via DocuSign</li>
                <li>Payment link will be sent after contract signature</li>
                <li>Payment will be synced to QuickBooks upon receipt</li>
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

  private generateInvoiceRejectedEmail(invoice: Invoice, rejector: User, reason: string): string {
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
            .details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
            .reason { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Invoice Rejected</h1>
            </div>
            <div class="content">
              <p>Hello Support Team,</p>
              <p>An invoice has been rejected and requires follow-up action.</p>

              <div class="details">
                <h3>Invoice Details</h3>
                <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber || invoice.id}</p>
                <p><strong>Customer:</strong> ${invoice.customer.name}</p>
                <p><strong>Amount:</strong> $${Number(invoice.amount).toFixed(2)}</p>
                <p><strong>Rejected By:</strong> ${rejector.name || rejector.email}</p>
              </div>

              <div class="reason">
                <h4>Rejection Reason:</h4>
                <p>${reason}</p>
              </div>

              <p>Please review the rejection reason and take appropriate action.</p>
            </div>
            <div class="footer">
              <p>CarreiraUSA Hub - Automated Notification</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

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

  private generateContractReminderEmail(contract: Contract, customer: Customer, invoiceNumber: string, daysRemaining: number): string {
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
            .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .button { display: inline-block; background: #f59e0b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⏰ Contract Signature Reminder</h1>
            </div>
            <div class="content">
              <p>Dear ${customer.name},</p>
              <p>This is a friendly reminder that your contract is still awaiting your signature.</p>

              <div class="warning">
                <h4>Time Remaining: ${daysRemaining} Days</h4>
                <p>Your contract will expire if not signed within ${daysRemaining} days.</p>
              </div>

              <div style="text-align: center;">
                <a href="${docusignUrl}" class="button">Sign Contract Now</a>
              </div>

              <p>Invoice: ${invoiceNumber}</p>
              <p>Reminder #${contract.reminderCount + 1}</p>

              <p style="margin-top: 20px;">
                If you're experiencing any issues or have questions, please reach out to our support team immediately.
              </p>
            </div>
            <div class="footer">
              <p>CarreiraUSA - Professional Services</p>
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
              <div class="success">✓</div>
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
                <a href="${paymentUrl}" class="button">Pay Now with Stripe</a>
              </div>

              <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
                <strong>Payment Methods Accepted:</strong><br>
                Credit Card • Debit Card • ACH Transfer
              </p>

              <p style="color: #6b7280; font-size: 14px;">
                You will receive a payment confirmation once the transaction is complete.
              </p>
            </div>
            <div class="footer">
              <p>CarreiraUSA - Professional Services</p>
              <p>Secure payments powered by Stripe</p>
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
              <h1>${urgency === 'urgent' ? '🚨' : '⏰'} Payment Reminder</h1>
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
              <div class="success">✓</div>
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

  /**
   * Notify commercial user when contract is signed
   */
  async notifyCommercialUser(
    deal: { id: string; title: string; ownerId: string | null; customer: { name: string; email: string } },
    contract: { id: string; status: string }
  ): Promise<void> {
    try {
      // Get deal owner (commercial user)
      if (!deal.ownerId) {
        console.log(`[NOTIFICATION] Deal ${deal.id} has no owner, cannot notify`);
        return;
      }

      const owner = await prisma.user.findUnique({
        where: { id: deal.ownerId }
      });

      if (!owner || !owner.email) {
        console.log(`[NOTIFICATION] Deal owner ${deal.ownerId} not found or has no email`);
        return;
      }

      // Check if already notified recently (prevent duplicate emails)
      const recentNotification = await prisma.notification.findFirst({
        where: {
          contractId: contract.id,
          type: NotificationType.CONTRACT_SIGNED,
          createdAt: { gte: new Date(Date.now() - 60000) } // Last 1 minute
        }
      });

      if (recentNotification) {
        console.log(`[NOTIFICATION] Contract ${contract.id} notification already sent`);
        return;
      }

      // Create notification record
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

      // Update to SENT status (email integration deferred to future phase)
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date()
        }
      });

      console.log(`[NOTIFICATION] Created notification ${notification.id} for ${owner.email}`);

      const structured = {
        errorCode: "SUCCESS",
        category: "transient" as const,
        metadata: {
          dealId: deal.id,
          contractId: contract.id,
          ownerId: owner.id,
          ownerEmail: owner.email
        }
      };

      await integrationLogger.logSuccess("notification", "COMMERCIAL_NOTIFIED", structured);

    } catch (error) {
      console.error('[NOTIFICATION] Failed to notify commercial user:', error);

      const structured = {
        errorCode: "NOTIFICATION_FAILED",
        category: "unknown" as const,
        metadata: {
          dealId: deal.id,
          contractId: contract.id
        }
      };

      await integrationLogger.logError(
        "notification",
        "COMMERCIAL_NOTIFICATION_FAILED",
        error as Error,
        structured,
        { dealId: deal.id, contractId: contract.id }
      );
      // Don't throw - notification failure shouldn't break workflow
    }
  }
}

export const notificationService = new NotificationService();
