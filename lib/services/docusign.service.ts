import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as crypto from 'crypto';
import { CircuitBreaker, CircuitOpenError } from "@/lib/utils/circuit-breaker";
import { integrationLogger, StructuredErrorData } from "@/lib/utils/logger";
import { prisma } from "@/lib/db";

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  amount: any;
  dueDate: Date;
  customerId?: string;
  installments?: any;
  deal?: {
    title: string;
  } | null;
  lineItems?: Array<{
    serviceItemId?: string;
    description?: string;
  }> | null;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  cpf?: string | null;
  passport?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  ssn?: string | null;
}

function getPreferredCustomerIdentificationValue(customer: Customer): string {
  return customer.ssn || customer.cpf || customer.passport || '';
}

function getInvoiceServiceDescriptionValue(invoice: Invoice): string {
  const lineItem = Array.isArray(invoice.lineItems) ? invoice.lineItems[0] : null;
  return lineItem?.description || invoice.deal?.title || 'Professional Services';
}

// Per-tab dimension/position overrides. Prevents long values from overflowing
// or overlapping adjacent static template characters.
const TAB_OVERRIDES: Record<string, { width?: string; height?: string; xPosition?: string }> = {
  client_address:  { width: '280' },
  payment_plan:    { height: '30' },
  invoice_numbers: { width: '425', height: '50' },
};

// Prefix-based overrides — applied when no exact match found.
const TAB_PREFIX_OVERRIDES: Array<{
  prefix: string;
  overrides: { width?: string; height?: string; xPosition?: string };
}> = [
  // Shift installment date tabs 12px right to clear the "/" static char in the Anexo template.
  { prefix: 'due_date_', overrides: { xPosition: '226' } },
];

function buildTextTab(label: string, value: string) {
  const base: Record<string, string> = { tabLabel: label, value, locked: 'true', shared: 'true' };
  const exact = TAB_OVERRIDES[label];
  const prefix = TAB_PREFIX_OVERRIDES.find((p) => label.startsWith(p.prefix))?.overrides;
  const overrides = exact ?? prefix;
  if (overrides?.width)     base.width     = overrides.width;
  if (overrides?.height)    base.height    = overrides.height;
  if (overrides?.xPosition) base.xPosition = overrides.xPosition;
  return base;
}

function getTrimmedEnv(name: string, fallback = ''): string {
  const value = process.env[name];
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
}

function sanitizeTemplateId(templateId?: string | null): string | null {
  if (typeof templateId !== 'string') {
    return null;
  }
  const trimmed = templateId.trim();
  return trimmed || null;
}

type DocuSignTextTab = Record<string, string>;

type TemplateEnvelopeSigner = {
  email: string;
  name: string;
  recipientId: string;
  routingOrder: string;
  roleName?: string;
  tabs?: {
    textTabs: DocuSignTextTab[];
  };
};

export function buildTemplateEnvelopeSigners(params: {
  clientEmail: string;
  clientName: string;
  clientRoleName: string;
  clientTextTabs: DocuSignTextTab[];
}): TemplateEnvelopeSigner[] {
  const thaisName = getTrimmedEnv('DOCUSIGN_SIGNER_THAIS_NAME', 'Thais');
  const thaisEmail = getTrimmedEnv('DOCUSIGN_SIGNER_THAIS_EMAIL', 'people@carreirausa.com');
  const witnessOneName = getTrimmedEnv('DOCUSIGN_SIGNER_WITNESS1_NAME', 'Nadya');
  const witnessOneEmail = getTrimmedEnv('DOCUSIGN_SIGNER_WITNESS1_EMAIL', 'people@carreirausa.com');
  const witnessTwoName = getTrimmedEnv('DOCUSIGN_SIGNER_WITNESS2_NAME', 'Diego Milan');
  const witnessTwoEmail = getTrimmedEnv('DOCUSIGN_SIGNER_WITNESS2_EMAIL', 'juridico@carreirausa.com');

  // recipientIds MUST match template definitions (consistent across all 9 templates):
  //   1 = Client, 2 = CarreiraUSA, 3 = Testemunha 1, 4 = Testemunha 2
  return [
    {
      email: thaisEmail,
      name: thaisName,
      recipientId: '2',
      roleName: 'CarreiraUSA',
      routingOrder: '1',
    },
    {
      email: witnessOneEmail,
      name: witnessOneName,
      recipientId: '3',
      roleName: 'Testemunha 1',
      routingOrder: '2',
    },
    {
      email: witnessTwoEmail,
      name: witnessTwoName,
      recipientId: '4',
      roleName: 'Testemunha 2',
      routingOrder: '3',
    },
    {
      email: params.clientEmail,
      name: params.clientName,
      recipientId: '1',
      roleName: params.clientRoleName,
      routingOrder: '4',
      tabs: {
        textTabs: params.clientTextTabs,
      },
    },
  ];
}

async function buildDocuSignCustomFields(
  invoice: Invoice,
  customer: Customer
): Promise<Record<string, string>> {
  const customFields: Record<string, string> = {};
  const amount = Number(invoice.amount);

  customFields.client_name = customer.name;
  customFields.client_email = customer.email;
  customFields.client_cpf = customer.cpf || '';
  customFields.client_passport = customer.passport || '';
  customFields.client_ssn_last4 = getPreferredCustomerIdentificationValue(customer);
  customFields.client_address = [
    customer.address,
    customer.city,
    customer.state,
    customer.zipCode,
  ]
    .map((part) => (typeof part === 'string' ? part.trim() : part))
    .filter(Boolean)
    .join(', ');
  customFields.contract_date_day = new Date().getDate().toString();
  customFields.contract_date_month = new Date().toLocaleDateString('pt-BR', { month: 'long' });
  customFields.contract_date_year = new Date().getFullYear().toString().slice(-2);
  customFields.customer_name = customer.name;
  customFields.customer_email = customer.email;
  customFields.invoice_number = invoice.invoiceNumber || invoice.id;
  customFields.invoice_numbers = invoice.invoiceNumber || invoice.id;
  customFields.invoice_amount = `$${amount.toFixed(2)}`;
  customFields.invoice_due_date = new Date(invoice.dueDate).toLocaleDateString('en-US');
  customFields.amount = `$${amount.toFixed(2)}`;
  customFields.due_date = new Date(invoice.dueDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  customFields.service_description = getInvoiceServiceDescriptionValue(invoice);

  const installmentData = invoice.installments as any;

  if (invoice.customerId && installmentData?.seriesId) {
    const seriesInvoices = await prisma.invoice.findMany({
      where: {
        customerId: invoice.customerId,
        installments: { path: ['seriesId'], equals: installmentData.seriesId },
      },
      orderBy: { dueDate: 'asc' },
    });

    const totalAmount = seriesInvoices.reduce(
      (sum, seriesInvoice) => sum + Number(seriesInvoice.amount),
      0
    );

    customFields.total_amount = `$${totalAmount.toFixed(2)}`;
    customFields.installment_count = seriesInvoices.length.toString();

    const entryInvoice = seriesInvoices.find(
      (seriesInvoice) => (seriesInvoice.installments as any)?.isFirstInstallment
    );
    const regularInvoices = seriesInvoices.filter(
      (seriesInvoice) => !(seriesInvoice.installments as any)?.isFirstInstallment
    );

    if (entryInvoice && regularInvoices.length > 0) {
      const entryAmount = Number(entryInvoice.amount);
      customFields.entry_amount = `$${entryAmount.toFixed(2)}`;
      customFields.entry_due_date = new Date(entryInvoice.dueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      customFields.payment_plan = `Entrada: $${entryAmount.toFixed(2)} + ${regularInvoices.length}x $${Number(regularInvoices[0].amount).toFixed(2)}`;
    } else if (seriesInvoices.length > 1) {
      customFields.entry_amount = '';
      customFields.entry_due_date = '';
      customFields.payment_plan = `${seriesInvoices.length}x $${Number(seriesInvoices[0].amount).toFixed(2)}`;
    } else {
      customFields.entry_amount = '';
      customFields.entry_due_date = '';
      customFields.payment_plan = `Pagamento unico: $${amount.toFixed(2)}`;
    }

    seriesInvoices.forEach((seriesInvoice, index) => {
      const slot = index + 1;
      const installmentAmount = Number(seriesInvoice.amount);
      const dueDateLong = new Date(seriesInvoice.dueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      const installmentMeta = seriesInvoice.installments as any;

      customFields[`installment_amount_${slot}`] = `$${installmentAmount.toFixed(2)}`;
      customFields[`due_date_${slot}`] = dueDateLong;
      customFields[`due_date_short_${slot}`] = new Date(seriesInvoice.dueDate).toLocaleDateString('pt-BR');
      customFields[`invoice_number_${slot}`] = seriesInvoice.invoiceNumber || '';

      // installment_desc_* intentionally left empty — the Anexo template
      // already has static labels ("Down Payment / Entrada", "1st/1ª Parcela N")
      // in the label column. Sending a value here causes text overlap.
      customFields[`installment_desc_${slot}`] = '';
    });

    for (let slot = seriesInvoices.length + 1; slot <= 12; slot++) {
      customFields[`installment_amount_${slot}`] = '';
      customFields[`due_date_${slot}`] = '';
      customFields[`due_date_short_${slot}`] = '';
      customFields[`invoice_number_${slot}`] = '';
      customFields[`installment_desc_${slot}`] = '';
    }

    if (regularInvoices.length > 0) {
      customFields.installment_amount = `$${Number(regularInvoices[0].amount).toFixed(2)}`;
    }

    customFields.invoice_numbers = seriesInvoices
      .map((seriesInvoice) => seriesInvoice.invoiceNumber)
      .filter(Boolean)
      .join(', ');
  } else {
    customFields.total_amount = `$${amount.toFixed(2)}`;
    customFields.payment_plan = `Pagamento unico: $${amount.toFixed(2)}`;
    customFields.installment_count = '1';
    customFields.entry_amount = '';
    customFields.installment_amount = '';
    customFields.installment_amount_1 = `$${amount.toFixed(2)}`;
    customFields.due_date_1 = new Date(invoice.dueDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    customFields.due_date_short_1 = new Date(invoice.dueDate).toLocaleDateString('pt-BR');
    customFields.invoice_number_1 = invoice.invoiceNumber || invoice.id;
    customFields.installment_desc_1 = 'Pagamento unico';

    for (let slot = 2; slot <= 12; slot++) {
      customFields[`installment_amount_${slot}`] = '';
      customFields[`due_date_${slot}`] = '';
      customFields[`due_date_short_${slot}`] = '';
      customFields[`invoice_number_${slot}`] = '';
      customFields[`installment_desc_${slot}`] = '';
    }
  }

  return customFields;
}

/**
 * Required customer fields for contract generation.
 * Contract cannot be sent without these fields populated.
 */
export const CONTRACT_REQUIRED_FIELDS = [
  { field: 'address', label: 'Endereço' },
  { field: 'email', label: 'Email' },
] as const;

/**
 * At least one of these ID fields must be present
 */
export const CONTRACT_REQUIRED_ID_FIELDS = [
  { field: 'cpf', label: 'CPF' },
  { field: 'passport', label: 'Passaporte' },
  { field: 'ssn', label: 'SSN (últimos 4 dígitos)' },
] as const;

/**
 * Validate that a customer has all required fields for contract generation.
 * Returns list of missing fields, or empty array if all good.
 */
export function validateCustomerForContract(customer: Customer): { field: string; label: string }[] {
  const missing: { field: string; label: string }[] = [];

  // Check required fields
  for (const { field, label } of CONTRACT_REQUIRED_FIELDS) {
    const value = customer[field as keyof Customer];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      missing.push({ field, label });
    }
  }

  // Check at least one ID field is present
  const hasAnyId = CONTRACT_REQUIRED_ID_FIELDS.some(({ field }) => {
    const value = customer[field as keyof Customer];
    return value && (typeof value !== 'string' || value.trim() !== '');
  });

  if (!hasAnyId) {
    missing.push({
      field: 'identification',
      label: 'Documento de identificação (CPF, Passaporte ou SSN)',
    });
  }

  return missing;
}

/**
 * Program-to-Annex mapping for DocuSign templates.
 * Each program corresponds to a specific contract annex (A-F).
 *
 * Programs are identified by QuickBooks Service Item names (not deal titles).
 * The serviceItemId in invoice lineItems points to a QB Item whose name
 * contains the program keyword (e.g., "PASS Advanced", "COMBO").
 *
 * Template IDs stored in environment variables:
 *   DOCUSIGN_TEMPLATE_PASS_ADVANCED=<template-id>   → Anexo A
 *   DOCUSIGN_TEMPLATE_PASS=<template-id>             → Anexo B
 *   DOCUSIGN_TEMPLATE_COMBO=<template-id>            → Anexo C
 *   DOCUSIGN_TEMPLATE_START=<template-id>            → Anexo D
 *   DOCUSIGN_TEMPLATE_AVULSO=<template-id>           → Anexo E
 *   DOCUSIGN_TEMPLATE_UPGRADE=<template-id>          → Anexo F
 *   DOCUSIGN_TEMPLATE_NEW_PASS=<template-id>         → Anexo G
 *   DOCUSIGN_TEMPLATE_TREINAMENTO=<template-id>      → Anexo H
 *   DOCUSIGN_TEMPLATE_EARLY_CAREER=<template-id>     → Anexo I
 *   DOCUSIGN_TEMPLATE_ID=<template-id>               → Fallback (template genérico)
 *
 * Alternative: Map specific QB Item IDs directly via:
 *   DOCUSIGN_TEMPLATE_MAP={"19":"<template-id>","62":"<template-id>",...}
 */
export interface ProgramMapping {
  annex: string;
  envVar: string;
  keywords: string[];
}

export const PROGRAM_TEMPLATE_MAP: ProgramMapping[] = [
  // Order matters: "pass advanced" and "new pass" must match BEFORE "pass"
  {
    annex: 'A',
    envVar: 'DOCUSIGN_TEMPLATE_PASS_ADVANCED',
    keywords: ['pass advanced', 'advanced', 'mentoria advanced', 'mentoria completa'],
  },
  {
    annex: 'G',
    envVar: 'DOCUSIGN_TEMPLATE_NEW_PASS',
    keywords: ['new pass'],
  },
  {
    annex: 'B',
    envVar: 'DOCUSIGN_TEMPLATE_PASS',
    keywords: ['pass', 'mentoria pass'],
  },
  {
    annex: 'C',
    envVar: 'DOCUSIGN_TEMPLATE_COMBO',
    keywords: ['combo', 'combo pass', 'material + grupo', 'material e grupo'],
  },
  {
    annex: 'D',
    envVar: 'DOCUSIGN_TEMPLATE_START',
    keywords: ['start', 'conteúdo gravado', 'conteudo gravado'],
  },
  {
    annex: 'E',
    envVar: 'DOCUSIGN_TEMPLATE_AVULSO',
    keywords: ['avulso', 'individual', 'serviço avulso', 'servico avulso'],
  },
  {
    annex: 'F',
    envVar: 'DOCUSIGN_TEMPLATE_UPGRADE',
    keywords: ['upgrade', 'downgrade', 'migração', 'migracao'],
  },
  {
    annex: 'H',
    envVar: 'DOCUSIGN_TEMPLATE_TREINAMENTO',
    keywords: ['treinamento', 'training'],
  },
  {
    annex: 'I',
    envVar: 'DOCUSIGN_TEMPLATE_EARLY_CAREER',
    keywords: ['early career', 'early-career'],
  },
];

/**
 * Resolve the correct DocuSign template ID for a contract.
 *
 * Resolution order:
 * 1. Direct QB Item ID mapping (DOCUSIGN_TEMPLATE_MAP env var)
 * 2. Keyword matching against service item name or deal title
 * 3. DOCUSIGN_TEMPLATE_ID fallback
 *
 * @param serviceItemName - Name of the QuickBooks service item (from invoice lineItems)
 * @param serviceItemId - QuickBooks Item ID (for direct mapping)
 * @param dealTitle - Deal title (secondary fallback for keyword matching)
 */
export function resolveTemplateForProgram(params: {
  serviceItemName?: string | null;
  serviceItemId?: string | null;
  dealTitle?: string | null;
}): {
  templateId: string | null;
  annex: string | null;
  program: string | null;
} {
  const { serviceItemName, serviceItemId, dealTitle } = params;

  // 1. Try direct QB Item ID → Template ID mapping
  if (serviceItemId) {
    const directMap = process.env.DOCUSIGN_TEMPLATE_MAP;
    if (directMap) {
      try {
        const map = JSON.parse(directMap) as Record<string, string>;
        if (map[serviceItemId]) {
          const templateId = sanitizeTemplateId(map[serviceItemId]);
          console.log(`[DOCUSIGN] Direct map: QB Item ${serviceItemId} → template ${templateId}`);
          return { templateId, annex: null, program: serviceItemName || null };
        }
      } catch {
        console.warn('[DOCUSIGN] Failed to parse DOCUSIGN_TEMPLATE_MAP env var');
      }
    }
  }

  // 2. Keyword matching against service item name or deal title
  const textToMatch = serviceItemName || dealTitle || null;
  if (textToMatch) {
    const normalized = textToMatch.toLowerCase().trim();

    for (const mapping of PROGRAM_TEMPLATE_MAP) {
      const matched = mapping.keywords.some(kw => normalized.includes(kw));
      if (matched) {
        const templateId = sanitizeTemplateId(process.env[mapping.envVar]);
        if (templateId) {
          console.log(`[DOCUSIGN] "${textToMatch}" matched Annex ${mapping.annex} → template ${templateId}`);
          return { templateId, annex: mapping.annex, program: mapping.keywords[0] };
        }
        console.log(`[DOCUSIGN] "${textToMatch}" matched Annex ${mapping.annex} but no template configured (${mapping.envVar})`);
        break;
      }
    }
  }

  // 3. Fallback to generic template
  const fallback = sanitizeTemplateId(process.env.DOCUSIGN_TEMPLATE_ID);
  if (fallback) {
    console.log(`[DOCUSIGN] Using fallback template for "${textToMatch || 'unknown program'}"`);
  } else {
    console.warn(`[DOCUSIGN] No template found for "${textToMatch || 'unknown'}" and no fallback configured`);
  }
  return { templateId: fallback, annex: null, program: null };
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
    this.privateKey = (process.env.DOCUSIGN_PRIVATE_KEY || "").replace(/\\n/g, '\n');
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

  private async getPrimaryTemplateSignerRoleName(
    templateId: string,
    token?: string
  ): Promise<string> {
    const sanitizedTemplateId = sanitizeTemplateId(templateId);
    if (!sanitizedTemplateId) {
      return 'Client';
    }

    const accessToken = token || await this.getAccessToken();
    const url = `${this.baseUrl}/restapi/v2.1/accounts/${this.accountId}/templates/${sanitizedTemplateId}/recipients`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[DOCUSIGN] Failed to inspect template recipients for ${sanitizedTemplateId}; defaulting to Client role`);
      return 'Client';
    }

    const data = await response.json();
    const clientSigner = data.signers?.find((s: any) =>
      !s.name || s.name.trim() === '' || !s.email || s.email.trim() === ''
    );
    const roleName = clientSigner?.roleName;
    return typeof roleName === 'string' && roleName.trim() !== ''
      ? roleName.trim()
      : 'Client';
  }

  /**
   * Make API request to DocuSign
   */
  private async apiRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    const startTime = Date.now();
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
          const error: any = new Error(`DocuSign API error: ${response.status} ${response.statusText}`);
          error.status = response.status;
          error.responseText = errorText;
          throw error;
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return response.json();
        }

        return response.arrayBuffer();
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;

      if (error instanceof CircuitOpenError) {
        const structured: StructuredErrorData = {
          errorCode: "CIRCUIT_OPEN",
          category: "transient",
          severity: "error",
          recovery: "wait",
          metadata: {
            endpoint,
            method: options.method || "GET",
          },
        };

        await integrationLogger.logError(
          "docusign",
          endpoint,
          error,
          structured,
          { endpoint, method: options.method || "GET" }
        );
        return null;
      }

      // Log other errors with structured context
      const structured: StructuredErrorData = {
        errorCode: (error as any)?.code || `HTTP_${(error as any)?.status || 500}`,
        category: this.categorizeError(error),
        metadata: {
          statusCode: (error as any)?.status,
          message: (error as any)?.message,
          responseText: (error as any)?.responseText,
        },
      };

      await integrationLogger.logError(
        "docusign",
        endpoint,
        error as any,
        structured,
        { endpoint, method: options.method || "GET" },
        0
      );

      throw error;
    }
  }

  private categorizeError(error: any): "transient" | "permanent" | "auth" | "validation" | "unknown" {
    const status = error?.status;
    const message = error?.message || "";

    if (status === 429 || status === 503 || message.includes("timeout")) {
      return "transient";
    }
    if (status === 401 || message.includes("unauthorized")) {
      return "auth";
    }
    if (status === 400) {
      return "validation";
    }
    if (status === 403 || status === 404) {
      return "permanent";
    }
    return "unknown";
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
   * Create or update contact in DocuSign
   * Returns DocuSign contact ID or null if operation failed
   */
  async createOrUpdateContact(customerData: {
    email: string;
    name: string;
    phone?: string;
  }): Promise<string | null> {
    try {
      // DocuSign doesn't have a separate Contacts API in the eSignature REST API
      // Contacts are managed at the account level through the Admin API
      // For the eSignature API, recipients are specified per envelope
      // So we'll just return the email as the "contact ID" since DocuSign
      // identifies recipients by email address

      // In a production system with DocuSign Admin API access, you would:
      // 1. Check if contact exists: GET /v2.1/accounts/{accountId}/contacts
      // 2. Create if not exists: POST /v2.1/accounts/{accountId}/contacts
      // 3. Update if exists: PUT /v2.1/accounts/{accountId}/contacts/{contactId}

      // For now, we'll use email as the identifier since that's what
      // DocuSign uses for envelope recipients
      console.log(`[DOCUSIGN] Contact prepared for ${customerData.email}`);
      return customerData.email; // Return email as contact ID

    } catch (error) {
      console.error('[DOCUSIGN] Failed to create/update contact:', error);
      // Log error but return null for graceful degradation
      const { integrationLogger } = await import("@/lib/utils/logger");
      await integrationLogger.logError(
        "docusign",
        "createOrUpdateContact",
        error as Error,
        {
          errorCode: "CONTACT_SYNC_FAILED",
          category: "unknown",
        },
        { email: customerData.email }
      );
      return null;
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
                  { documentId: '1', pageNumber: '1', recipientId: '1', xPosition: '50', yPosition: '520' },
                ],
                dateSignedTabs: [
                  { documentId: '1', pageNumber: '1', recipientId: '1', xPosition: '200', yPosition: '520' },
                ],
              },
            },
            {
              email: getTrimmedEnv('DOCUSIGN_SIGNER_THAIS_EMAIL', 'people@carreirausa.com'),
              name: getTrimmedEnv('DOCUSIGN_SIGNER_THAIS_NAME', 'Thais'),
              recipientId: '2',
              routingOrder: '2',
              tabs: {
                signHereTabs: [
                  { documentId: '1', pageNumber: '1', recipientId: '2', xPosition: '350', yPosition: '520' },
                ],
              },
            },
            {
              email: getTrimmedEnv('DOCUSIGN_SIGNER_WITNESS1_EMAIL', 'people@carreirausa.com'),
              name: getTrimmedEnv('DOCUSIGN_SIGNER_WITNESS1_NAME', 'Nadya'),
              recipientId: '3',
              routingOrder: '3',
              tabs: {
                signHereTabs: [
                  { documentId: '1', pageNumber: '1', recipientId: '3', xPosition: '50', yPosition: '620' },
                ],
              },
            },
            {
              email: getTrimmedEnv('DOCUSIGN_SIGNER_WITNESS2_EMAIL', 'juridico@carreirausa.com'),
              name: getTrimmedEnv('DOCUSIGN_SIGNER_WITNESS2_NAME', 'Diego Milan'),
              recipientId: '4',
              routingOrder: '4',
              tabs: {
                signHereTabs: [
                  { documentId: '1', pageNumber: '1', recipientId: '4', xPosition: '350', yPosition: '620' },
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
   * Create envelope from DocuSign template with dynamic data
   *
   * Uses Composite Templates pattern for maximum flexibility:
   * - serverTemplates: Reference to template created in DocuSign UI
   * - inlineTemplates: Runtime recipient data and tab values
   *
   * This is the PREFERRED method for production. Falls back to inline PDF
   * if DOCUSIGN_TEMPLATE_ID is not configured.
   *
   * @param invoice Invoice data for contract
   * @param customer Customer data for signer
   * @returns Envelope ID
   */
  async createEnvelopeFromTemplate(
    invoice: Invoice,
    customer: Customer
  ): Promise<string> {
    try {
      // Resolve template based on QB service item name or deal title
      const lineItem = Array.isArray(invoice.lineItems) ? invoice.lineItems[0] : null;
      const resolved = resolveTemplateForProgram({
        serviceItemName: lineItem?.description || null,
        serviceItemId: lineItem?.serviceItemId || null,
        dealTitle: invoice.deal?.title || null,
      });
      const templateId = resolved.templateId;

      // If no template configured, fall back to inline PDF generation
      if (!templateId) {
        console.log('[DOCUSIGN] No template configured for this program, falling back to inline PDF');
        return this.createEnvelopeFromInvoice(invoice, customer);
      }

      const annexLabel = resolved.annex ? ` (Anexo ${resolved.annex})` : '';
      const programLabel = resolved.program || lineItem?.description || invoice.deal?.title || 'unknown';
      const customFields = await buildDocuSignCustomFields(invoice, customer);
      const clientRoleName = await this.getPrimaryTemplateSignerRoleName(templateId);
      console.log(`[DOCUSIGN] Creating envelope from template ${templateId}${annexLabel} for program "${programLabel}"`);

      const envelopeDefinition = {
        status: 'sent',
        emailSubject: `CarreiraUSA - Contract for Signature (Invoice ${invoice.invoiceNumber || invoice.id})`,
        emailBlurb: 'Please review and sign the attached service agreement to proceed.',
        templateId: templateId,
        templateRoles: [
          {
            email: customer.email,
            name: customer.name,
            roleName: clientRoleName,
            tabs: {
              textTabs: Object.entries(customFields).map(([label, value]) =>
                buildTextTab(label, value)
              ),
            },
          },
        ],
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

      // Create envelope via API
      const result = await this.apiRequest('/envelopes', {
        method: 'POST',
        body: JSON.stringify(envelopeDefinition),
      });

      if (!result || !result.envelopeId) {
        throw new Error('Failed to create envelope - no envelope ID returned');
      }

      console.log(`[DOCUSIGN] Template-based envelope created: ${result.envelopeId}`);
      return result.envelopeId;

    } catch (error) {
      console.error('[DOCUSIGN] Failed to create envelope from template:', error);

      // If template fails, fall back to inline PDF as last resort
      if (process.env.DOCUSIGN_TEMPLATE_ID) {
        console.log('[DOCUSIGN] Template failed, attempting fallback to inline PDF');
        try {
          return await this.createEnvelopeFromInvoice(invoice, customer);
        } catch (fallbackError) {
          console.error('[DOCUSIGN] Fallback also failed:', fallbackError);
        }
      }

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
   * List available DocuSign templates
   * Returns templates that commercial users can select from
   */
  async listTemplates(): Promise<Array<{
    templateId: string;
    name: string;
    description: string;
    created: string;
    lastModified: string;
    shared: boolean;
  }>> {
    try {
      const token = await this.getAccessToken();
      const url = `${this.baseUrl}/restapi/v2.1/accounts/${this.accountId}/templates?count=100&order_by=name`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DOCUSIGN] Failed to list templates:', response.status, errorText);
        throw new Error(`Failed to list templates: ${response.statusText}`);
      }

      const data = await response.json();
      const templates = data.envelopeTemplates || [];

      const configuredIds = new Set(
        PROGRAM_TEMPLATE_MAP
          .map(m => sanitizeTemplateId(process.env[m.envVar]))
          .filter(Boolean)
      );
      const fallbackId = sanitizeTemplateId(process.env.DOCUSIGN_TEMPLATE_ID);
      if (fallbackId) configuredIds.add(fallbackId);

      return templates
        .filter((t: any) => configuredIds.has(t.templateId))
        .map((template: any) => ({
          templateId: template.templateId,
          name: template.name,
          description: template.description || '',
          created: template.created,
          lastModified: template.lastModified,
          shared: template.shared === 'true' || template.shared === true,
        }));

    } catch (error) {
      console.error('[DOCUSIGN] Error listing templates:', error);
      throw error;
    }
  }

  /**
   * Create envelope from a DocuSign template.
   *
   * Each template already contains the main contract + annex as two documents.
   * Text tabs are populated with customer/invoice data at runtime.
   */
  async createEnvelopeFromSelectedTemplate(
    templateId: string,
    signerEmail: string,
    signerName: string,
    customFields?: Record<string, string>
  ): Promise<string> {
    try {
      const sanitizedTemplateId = sanitizeTemplateId(templateId);
      if (!sanitizedTemplateId) {
        throw new Error('Template ID is required to create a DocuSign envelope');
      }
      const clientRoleName = await this.getPrimaryTemplateSignerRoleName(sanitizedTemplateId);
      console.log(`[DOCUSIGN] Creating envelope from template ${sanitizedTemplateId}`);

      const envelopeDefinition: any = {
        status: 'sent',
        emailSubject: 'CarreiraUSA - Contrato para Assinatura',
        emailBlurb: 'Por favor, revise e assine o contrato de prestação de serviços anexo.',
        templateId: sanitizedTemplateId,
        templateRoles: [
          {
            email: signerEmail,
            name: signerName,
            roleName: clientRoleName,
            tabs: {
              textTabs: customFields
                ? Object.entries(customFields).map(([label, value]) => buildTextTab(label, value))
                : [],
            },
          },
        ],
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

      const result = await this.apiRequest('/envelopes', {
        method: 'POST',
        body: JSON.stringify(envelopeDefinition),
      });

      if (!result || !result.envelopeId) {
        throw new Error('Failed to create envelope - no envelope ID returned');
      }

      console.log(`[DOCUSIGN] Envelope created: ${result.envelopeId}`);
      return result.envelopeId;

    } catch (error) {
      console.error('[DOCUSIGN] Error creating envelope from template:', error);
      throw error;
    }
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
