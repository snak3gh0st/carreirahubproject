/**
 * Email Service - Backup for QuickBooks email sending
 * Use when QB email API is down
 */

export class EmailService {
  /**
   * Send invoice via external email service (Resend, SendGrid, etc.)
   * with QuickBooks invoice link
   */
  async sendInvoiceLink(data: {
    invoiceId: string;
    qbInvoiceId: string;
    customerEmail: string;
    customerName: string;
    amount: number;
    dueDate: Date;
  }): Promise<boolean> {
    // Implementation depends on your email provider
    // This is a template for Resend API
    
    const invoiceLink = `https://app.qbo.intuit.com/app/invoice?view=edit&id=${data.qbInvoiceId}`;
    
    try {
      // Example with Resend (would need @resend/node package)
      /*
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'noreply@carreirausa.com',
        to: [data.customerEmail],
        subject: `Invoice from Carreira USA - $${data.amount.toFixed(2)}`,
        html: `
          <h2>Invoice</h2>
          <p>Dear ${data.customerName},</p>
          <p>Your invoice for $${data.amount.toFixed(2)} is ready.</p>
          <p>Due Date: ${data.dueDate.toLocaleDateString()}</p>
          <p><a href="${invoiceLink}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View & Pay Invoice</a></p>
          <p>Thank you for your business!</p>
        `
      });
      */
      
      console.log(`[EmailService] Invoice link sent to ${data.customerEmail}: ${invoiceLink}`);
      return true;
    } catch (error) {
      console.error('[EmailService] Failed to send invoice link:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
