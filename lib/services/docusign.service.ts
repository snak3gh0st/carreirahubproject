import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as crypto from 'crypto';
import { CircuitBreaker, CircuitOpenError } from "@/lib/utils/circuit-breaker";
import { prisma } from "@/lib/db";

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  amount: any;
  dueDate: Date;
  deal?: {
    title: string;
  } | null;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
}

/**
 * DocuSign Service
 *
 * Handles DocuSign API integration for contract generation and signing
 * Uses JWT authentication for secure access via direct HTTP calls
 */
export class DocuSignService {
  private integrationKey: string;
  private userId: string;
  private accountId: string;
  private baseUrl: string;
  private privateKey: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private circuitBreaker: CircuitBreaker;

  constructor() {
    this.integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY || "";
    this.userId = process.env.DOCUSIGN_USER_ID || "";
    this.accountId = process.env.DOCUSIGN_ACCOUNT_ID || "";
    this.baseUrl = process.env.DOCUSIGN_BASE_URL || "https://demo.docusign.net";
    this.privateKey = process.env.DOCUSIGN_PRIVATE_KEY || "";
    this.circuitBreaker = new CircuitBreaker("docusign");
  }

  /**
   * Authenticate with DocuSign using JWT Grant
   */
  async authenticateWithJWT(): Promise<string> {
    try {
      // Check if we have a valid cached token
      if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
        return this.accessToken;
      }

      // Validate required credentials
      if (!this.integrationKey || !this.userId || !this.privateKey) {
        throw new Error('DocuSign JWT credentials not configured. Please set DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, and DOCUSIGN_PRIVATE_KEY');
      }

      // Create JWT assertion
      const now = Math.floor(Date.now() / 1000);
      const oauthBasePath = this.baseUrl.includes('demo')
        ? 'https://account-d.docusign.com'
        : 'https://account.docusign.com';

      const header = {
        typ: 'JWT',
        alg: 'RS256',
      };

      const payload = {
        iss: this.integrationKey,
        sub: this.userId,
        aud: oauthBasePath.replace('https://', ''),
        iat: now,
        exp: now + 3600,
        scope: 'signature impersonation',
      };

      // Create JWT token
      const headerBase64 = Buffer.from(JSON.stringify(header)).toString('base64url');
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const signatureInput = `${headerBase64}.${payloadBase64}`;

      // Sign with RSA private key
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(signatureInput);
      const signature = sign.sign(this.privateKey, 'base64url');

      const jwtToken = `${signatureInput}.${signature}`;

      // Exchange JWT for access token
      const tokenResponse = await fetch(`${oauthBasePath}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwtToken}`,
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`JWT token exchange failed: ${errorText}`);
      }

      const tokenData = await tokenResponse.json();

      // Cache the token
      this.accessToken = tokenData.access_token;
      this.tokenExpiresAt = Date.now() + (3500 * 1000); // Expire 100 seconds before actual expiration

      console.log('[DOCUSIGN] Successfully authenticated with JWT');
      return this.accessToken as string;

    } catch (error) {
      console.error('[DOCUSIGN] JWT authentication failed:', error);
      throw new Error('DocuSign JWT authentication failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Get access token (with automatic JWT authentication)
   */
  private async getAccessToken(): Promise<string> {
    return await this.authenticateWithJWT();
  }

  /**
   * Make API request to DocuSign
   */
  private async apiRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    try {
      return await this.circuitBreaker.execute(async () => {
        const token = await this.getAccessToken();
        const url = `${this.baseUrl}/restapi/v2.1/accounts/${this.accountId}${endpoint}`;

        const response = await fetch(url, {
          ...options,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`DocuSign API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return response.json();
        }

        return response.arrayBuffer();
      });
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        console.warn(`[DocuSign] Circuit breaker open: ${error.message}`);
        await prisma.integrationLog.create({
          data: {
            service: "docusign",
            action: endpoint,
            status: "CIRCUIT_OPEN",
            payload: { endpoint, method: options.method || "GET" },
            error: error.message,
          },
        }).catch(err => console.error("[DocuSign] Failed to log circuit open:", err));
        return null;
      }
      throw error;
    }
  }

  /**
   * Generate PDF contract from invoice and customer data
   */
  async generateContractPDF(invoice: Invoice, customer: Customer): Promise<Buffer> {
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([612, 792]); // Letter size
      const { width, height } = page.getSize();

      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      let yPosition = height - 50;
      const leftMargin = 50;
      const lineHeight = 20;

      // Header
      page.drawText('CARREIRA USA', {
        x: leftMargin,
        y: yPosition,
        size: 24,
        font: boldFont,
        color: rgb(0.15, 0.39, 0.92),
      });

      yPosition -= 30;
      page.drawText('Professional Services Agreement', {
        x: leftMargin,
        y: yPosition,
        size: 16,
        font: boldFont,
      });

      yPosition -= 40;

      // Contract Information
      page.drawText('AGREEMENT DETAILS', {
        x: leftMargin,
        y: yPosition,
        size: 12,
        font: boldFont,
      });

      yPosition -= lineHeight;
      const today = new Date().toLocaleDateString();
      page.drawText(`Date: ${today}`, {
        x: leftMargin,
        y: yPosition,
        size: 10,
        font: regularFont,
      });

      yPosition -= lineHeight;
      page.drawText(`Invoice Number: ${invoice.invoiceNumber || invoice.id}`, {
        x: leftMargin,
        y: yPosition,
        size: 10,
        font: regularFont,
      });

      yPosition -= 30;

      // Client Information
      page.drawText('CLIENT INFORMATION', {
        x: leftMargin,
        y: yPosition,
        size: 12,
        font: boldFont,
      });

      yPosition -= lineHeight;
      page.drawText(`Name: ${customer.name}`, {
        x: leftMargin,
        y: yPosition,
        size: 10,
        font: regularFont,
      });

      yPosition -= lineHeight;
      page.drawText(`Email: ${customer.email}`, {
        x: leftMargin,
        y: yPosition,
        size: 10,
        font: regularFont,
      });

      if (customer.phone) {
        yPosition -= lineHeight;
        page.drawText(`Phone: ${customer.phone}`, {
          x: leftMargin,
          y: yPosition,
          size: 10,
          font: regularFont,
        });
      }

      yPosition -= 30;

      // Service Details
      page.drawText('SERVICE DETAILS', {
        x: leftMargin,
        y: yPosition,
        size: 12,
        font: boldFont,
      });

      yPosition -= lineHeight;
      if (invoice.deal) {
        page.drawText(`Service: ${invoice.deal.title}`, {
          x: leftMargin,
          y: yPosition,
          size: 10,
          font: regularFont,
        });
        yPosition -= lineHeight;
      }

      page.drawText(`Amount: $${Number(invoice.amount).toFixed(2)}`, {
        x: leftMargin,
        y: yPosition,
        size: 10,
        font: regularFont,
      });

      yPosition -= lineHeight;
      page.drawText(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, {
        x: leftMargin,
        y: yPosition,
        size: 10,
        font: regularFont,
      });

      yPosition -= 30;

      // Terms and Conditions
      page.drawText('TERMS AND CONDITIONS', {
        x: leftMargin,
        y: yPosition,
        size: 12,
        font: boldFont,
      });

      yPosition -= lineHeight;
      const terms = [
        '1. Services: CarreiraUSA will provide professional immigration consulting services',
        '   as described in the service package selected by the client.',
        '',
        '2. Payment: Client agrees to pay the total amount specified above by the due date.',
        '   Payment must be completed before service commencement.',
        '',
        '3. Refund Policy: Refunds are available according to our published refund policy.',
        '',
        '4. Confidentiality: Both parties agree to maintain confidentiality of all',
        '   information shared during the provision of services.',
        '',
        '5. Termination: Either party may terminate this agreement with 30 days notice.',
        '',
        '6. Governing Law: This agreement shall be governed by the laws of the United States.',
      ];

      for (const term of terms) {
        page.drawText(term, {
          x: leftMargin,
          y: yPosition,
          size: 9,
          font: regularFont,
        });
        yPosition -= 14;
      }

      yPosition -= 20;

      // Signature Section
      page.drawText('CLIENT SIGNATURE', {
        x: leftMargin,
        y: yPosition,
        size: 12,
        font: boldFont,
      });

      yPosition -= lineHeight;
      page.drawText('By signing below, you agree to the terms and conditions outlined above.', {
        x: leftMargin,
        y: yPosition,
        size: 9,
        font: regularFont,
      });

      yPosition -= 40;

      // Signature line
      page.drawLine({
        start: { x: leftMargin, y: yPosition },
        end: { x: leftMargin + 200, y: yPosition },
        thickness: 1,
        color: rgb(0, 0, 0),
      });

      yPosition -= lineHeight;
      page.drawText(`${customer.name}`, {
        x: leftMargin,
        y: yPosition,
        size: 9,
        font: regularFont,
      });

      yPosition -= lineHeight;
      page.drawText('Client Name', {
        x: leftMargin,
        y: yPosition,
        size: 8,
        font: regularFont,
        color: rgb(0.5, 0.5, 0.5),
      });

      // Date line
      yPosition += 40;
      page.drawLine({
        start: { x: leftMargin + 250, y: yPosition },
        end: { x: leftMargin + 350, y: yPosition },
        thickness: 1,
        color: rgb(0, 0, 0),
      });

      yPosition -= lineHeight;
      page.drawText('Date', {
        x: leftMargin + 250,
        y: yPosition,
        size: 8,
        font: regularFont,
        color: rgb(0.5, 0.5, 0.5),
      });

      // Footer
      page.drawText('CarreiraUSA - Professional Immigration Services', {
        x: width / 2 - 120,
        y: 30,
        size: 8,
        font: regularFont,
        color: rgb(0.5, 0.5, 0.5),
      });

      const pdfBytes = await pdfDoc.save();
      return Buffer.from(pdfBytes);

    } catch (error) {
      console.error('[DOCUSIGN] PDF generation failed:', error);
      throw new Error('Failed to generate contract PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Create envelope from invoice
   */
  async createEnvelopeFromInvoice(
    invoice: Invoice,
    customer: Customer
  ): Promise<string> {
    try {
      // Generate PDF contract
      const pdfBuffer = await this.generateContractPDF(invoice, customer);
      const pdfBase64 = pdfBuffer.toString('base64');

      // Create envelope definition
      const envelopeDefinition = {
        emailSubject: `CarreiraUSA - Contract for Signature (Invoice ${invoice.invoiceNumber || invoice.id})`,
        emailBlurb: 'Please review and sign the attached service agreement to proceed with payment.',
        status: 'sent',
        documents: [
          {
            documentBase64: pdfBase64,
            name: `Contract_${invoice.invoiceNumber || invoice.id}.pdf`,
            fileExtension: 'pdf',
            documentId: '1',
          },
        ],
        recipients: {
          signers: [
            {
              email: customer.email,
              name: customer.name,
              recipientId: '1',
              routingOrder: '1',
              tabs: {
                signHereTabs: [
                  {
                    documentId: '1',
                    pageNumber: '1',
                    recipientId: '1',
                    xPosition: '100',
                    yPosition: '550',
                  },
                ],
                dateSignedTabs: [
                  {
                    documentId: '1',
                    pageNumber: '1',
                    recipientId: '1',
                    xPosition: '300',
                    yPosition: '550',
                  },
                ],
              },
            },
          ],
        },
        notification: {
          useAccountDefaults: 'false',
          reminders: {
            reminderEnabled: 'true',
            reminderDelay: '3',
            reminderFrequency: '4',
          },
          expirations: {
            expireEnabled: 'true',
            expireAfter: '30',
            expireWarn: '3',
          },
        },
      };

      // Create envelope
      const result = await this.apiRequest('/envelopes', {
        method: 'POST',
        body: JSON.stringify(envelopeDefinition),
      });

      if (!result.envelopeId) {
        throw new Error('Failed to create envelope - no envelope ID returned');
      }

      console.log(`[DOCUSIGN] Envelope created: ${result.envelopeId}`);
      return result.envelopeId;

    } catch (error) {
      console.error('[DOCUSIGN] Failed to create envelope from invoice:', error);
      throw new Error('Failed to create DocuSign envelope: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Create envelope (legacy method)
   */
  async createEnvelope(data: {
    signerEmail: string;
    signerName: string;
    documentBase64: string;
    documentName: string;
    subject?: string;
    emailBlurb?: string;
  }): Promise<{
    envelopeId: string;
    status: string;
  }> {
    const envelopeDefinition = {
      emailSubject: data.subject || 'Please sign this document',
      emailBlurb: data.emailBlurb || 'Please review and sign the attached document.',
      status: 'sent',
      documents: [
        {
          documentBase64: data.documentBase64,
          name: data.documentName,
          fileExtension: 'pdf',
          documentId: '1',
        },
      ],
      recipients: {
        signers: [
          {
            email: data.signerEmail,
            name: data.signerName,
            recipientId: '1',
            routingOrder: '1',
            tabs: {
              signHereTabs: [
                {
                  documentId: '1',
                  pageNumber: '1',
                  recipientId: '1',
                  xPosition: '100',
                  yPosition: '100',
                },
              ],
            },
          },
        ],
      },
    };

    const result = await this.apiRequest('/envelopes', {
      method: 'POST',
      body: JSON.stringify(envelopeDefinition),
    });

    return {
      envelopeId: result.envelopeId || '',
      status: result.status || 'created',
    };
  }

  /**
   * Get envelope status
   */
  async getEnvelopeStatus(envelopeId: string): Promise<{
    status: string;
    statusDateTime: string;
    signedDateTime?: string;
  }> {
    const result = await this.apiRequest(`/envelopes/${envelopeId}`);

    return {
      status: result.status || 'unknown',
      statusDateTime: result.statusChangedDateTime || new Date().toISOString(),
      signedDateTime: result.completedDateTime,
    };
  }

  /**
   * Void expired envelope
   */
  async voidExpiredEnvelope(envelopeId: string): Promise<void> {
    try {
      await this.apiRequest(`/envelopes/${envelopeId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'voided',
          voidedReason: 'Contract expired - not signed within 30 days',
        }),
      });

      console.log(`[DOCUSIGN] Envelope ${envelopeId} voided due to expiration`);
    } catch (error) {
      console.error('[DOCUSIGN] Failed to void envelope:', error);
      throw error;
    }
  }

  /**
   * Get signing URL for embedded signing
   */
  async getSigningUrl(
    envelopeId: string,
    signerEmail: string,
    signerName: string,
    returnUrl: string
  ): Promise<string> {
    const recipientViewRequest = {
      authenticationMethod: 'none',
      email: signerEmail,
      userName: signerName,
      recipientId: '1',
      returnUrl: returnUrl,
    };

    const result = await this.apiRequest(
      `/envelopes/${envelopeId}/views/recipient`,
      {
        method: 'POST',
        body: JSON.stringify(recipientViewRequest),
      }
    );

    return result.url || '';
  }

  /**
   * Get envelope documents
   */
  async getEnvelopeDocuments(envelopeId: string): Promise<Array<{
    documentId: string;
    name: string;
    uri: string;
  }>> {
    const result = await this.apiRequest(`/envelopes/${envelopeId}/documents`);

    return (result.envelopeDocuments || []).map((doc: any) => ({
      documentId: doc.documentId || '',
      name: doc.name || '',
      uri: doc.uri || '',
    }));
  }

  /**
   * Download document
   */
  async downloadDocument(
    envelopeId: string,
    documentId: string
  ): Promise<Buffer> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}/restapi/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}/documents/${documentId}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download document: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

export const docusignService = new DocuSignService();
