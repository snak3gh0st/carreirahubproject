import { prisma } from "@/lib/db";
import { CircuitBreaker, CircuitOpenError } from "@/lib/utils/circuit-breaker";
import { integrationLogger, StructuredErrorData } from "@/lib/utils/logger";

/**
 * Diagnostic result for verbose send operations
 */
export interface SendInvoiceResult {
  success: boolean;
  httpStatus: number;
  emailStatus?: string;  // QB's EmailStatus field
  qbResponse: any;
  diagnostics: {
    endpoint: string;
    requestBody: any;
    responseHeaders: Record<string, string>;
    rawResponse: string;
    parsedResponse: any;
    hasFault: boolean;
    hasError: boolean;
    emailStatusBefore?: string;
    emailStatusAfter?: string;
  };
}

/**
 * Quickbooks Service
 *
 * Responsabilidade: Integração com Quickbooks API para sincronização de invoices e customers
 *
 * Configuração necessária no .env:
 * - QUICKBOOKS_CLIENT_ID: Client ID da aplicação
 * - QUICKBOOKS_CLIENT_SECRET: Client Secret da aplicação
 * - QUICKBOOKS_ENVIRONMENT: "production" ou "sandbox" (opcional, padrão: sandbox)
 *
 * Tokens são armazenados no banco de dados (SystemConfig) e carregados automaticamente
 */
export class QuickbooksService {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null;
  private refreshToken: string | null;
  private companyId: string;
  private baseUrl: string;
  private circuitBreaker: CircuitBreaker;
  private discountAccountRef: { value: string; name: string } | null = null;

  constructor() {
    this.clientId = process.env.QUICKBOOKS_CLIENT_ID || "";
    this.clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET || "";
    // Inicialmente null, serão carregados do banco após inicialização
    this.accessToken = null;
    this.refreshToken = null;
    this.companyId = "";
    this.circuitBreaker = new CircuitBreaker("quickbooks");

    // Quickbooks Sandbox: https://sandbox-quickbooks.api.intuit.com
    // Quickbooks Production: https://quickbooks.api.intuit.com
    // Set QUICKBOOKS_ENVIRONMENT=production in .env to use production API
    const isProduction = process.env.QUICKBOOKS_ENVIRONMENT === "production";
    this.baseUrl = isProduction
      ? "https://quickbooks.api.intuit.com"
      : "https://sandbox-quickbooks.api.intuit.com";
  }

  /**
   * Inicializar tokens a partir do banco de dados
   * DEVE ser chamado antes de usar o servico
   *
   * Retries up to 3 times with exponential backoff to handle transient
   * connection pool exhaustion (P2024) during heavy DB workloads.
   */
  async initialize(): Promise<void> {
    const maxRetries = 3;
    const baseDelayMs = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const config = await prisma.systemConfig.findUnique({
          where: { id: "system" },
        });

        if (config) {
          this.accessToken = config.quickbooks_access_token;
          this.refreshToken = config.quickbooks_refresh_token;
          this.companyId = config.quickbooks_company_id || "";
          console.log("[QuickBooks] Tokens carregados do banco de dados");
        } else {
          console.warn(
            "[QuickBooks] Nenhuma configuracao encontrada no banco. Use /api/quickbooks/auth/connect para autenticar."
          );
        }
        return; // Success - exit retry loop
      } catch (error: any) {
        const isPoolExhaustion = error?.code === "P2024" || error?.message?.includes("connection pool");

        if (isPoolExhaustion && attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          console.warn(
            `[QuickBooks] Connection pool exhausted on initialize (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        console.error(`[QuickBooks] Erro ao carregar tokens (attempt ${attempt}/${maxRetries}):`, error);
        if (attempt === maxRetries) {
          // On final failure, don't silently swallow - let caller know
          throw new Error(`Failed to load QuickBooks tokens after ${maxRetries} attempts: ${error.message}`);
        }
      }
    }
  }

  /**
   * Obter status de autenticação
   */
  async getAuthStatus(): Promise<{
    isAuthenticated: boolean;
    companyId: string | null;
    tokenExpiresAt: Date | null;
  }> {
    const config = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });

    return {
      isAuthenticated: config?.quickbooks_is_authenticated || false,
      companyId: config?.quickbooks_company_id || null,
      tokenExpiresAt: config?.quickbooks_token_expires_at || null,
    };
  }

  private async request(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    const startTime = Date.now();
    try {
      return await this.circuitBreaker.execute(async () => {
        if (!this.accessToken) {
          const error: any = new Error("Quickbooks access token not configured");
          error.status = 401;
          throw error;
        }

        if (!this.companyId || this.companyId.trim() === "") {
          const error: any = new Error("Quickbooks company ID not configured");
          error.status = 400;
          throw error;
        }

        const url = `${this.baseUrl}/v3/company/${this.companyId}${endpoint}`;

        console.log(`[QuickBooks] Requesting: ${url}`);

        const response = await fetch(url, {
          ...options,
          headers: {
            "Authorization": `Bearer ${this.accessToken}`,
            "Accept": "application/json",
            "Content-Type": "application/json",
            ...options.headers,
          },
        });

        if (response.status === 401) {
          const errorText = await response.text();
          console.error(`[QuickBooks] 401 Unauthorized: ${errorText}`);

          // Token expirado, tentar refresh se refresh token estiver configurado
          if (this.refreshToken) {
            try {
              console.log("[QuickBooks] Attempting to refresh access token...");
              await this.refreshAccessToken();
              return this.request(endpoint, options);
            } catch (error) {
              // Se refresh falhar, lançar erro informando que precisa de novo token
              throw new Error(`Quickbooks access token expired. Please update QUICKBOOKS_ACCESS_TOKEN in .env. Error: ${error instanceof Error ? error.message : String(error)}`);
            }
          } else {
            throw new Error(`Quickbooks access token expired or invalid. Status: 401. Response: ${errorText}`);
          }
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[QuickBooks] API Error ${response.status}: ${errorText}`);
          const error: any = new Error(`Quickbooks API error (${response.status}): ${response.statusText}`);
          error.status = response.status;
          error.responseText = errorText;
          throw error;
        }

        return response.json();
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;

      if (error instanceof CircuitOpenError) {
        // Circuit is open - log and return null/fallback
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
          "quickbooks",
          endpoint,
          error,
          structured,
          { endpoint, method: options.method || "GET" }
        );
        return null;
      }

      // Log other errors with structured context
      const structured: StructuredErrorData = {
        errorCode: this.extractErrorCode(error),
        category: this.categorizeError(error),
        metadata: {
          statusCode: (error as any)?.status,
          message: (error as any)?.message,
          responseText: (error as any)?.responseText,
        },
      };

      await integrationLogger.logError(
        "quickbooks",
        endpoint,
        error as any,
        structured,
        { endpoint, method: options.method || "GET" },
        0
      );

      throw error;
    }
  }

  private extractErrorCode(error: any): string {
    const status = error?.status;
    if (status === 401) return "AUTH_FAILED";
    if (status === 400) return "INVALID_REQUEST";
    if (status === 429) return "RATE_LIMITED";
    if (status === 503) return "SERVICE_UNAVAILABLE";
    return `HTTP_${status || 500}`;
  }

  private categorizeError(error: any): "transient" | "permanent" | "auth" | "validation" | "unknown" {
    const status = error?.status;
    const message = error?.message || "";

    if (status === 429 || status === 503 || message.includes("timeout")) {
      return "transient";
    }
    if (status === 401 || message.includes("token") || message.includes("unauthorized")) {
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
   * Refresh access token usando refresh token
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error("Quickbooks refresh token not configured");
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error("Quickbooks client credentials not configured");
    }

    // QuickBooks OAuth requires Basic Auth with client_id:client_secret
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");

    const response = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        "Authorization": `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to refresh Quickbooks access token: ${errorText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;

    // Update refresh token if a new one is provided
    if (data.refresh_token) {
      this.refreshToken = data.refresh_token;
    }

    // Salvar novo access token e refresh token em banco de dados
    // Retry the DB upsert to handle transient pool exhaustion (P2024)
    const expiresIn = data.expires_in || 3600; // padrao 1 hora
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const maxDbRetries = 3;
    for (let dbAttempt = 1; dbAttempt <= maxDbRetries; dbAttempt++) {
      try {
        await prisma.systemConfig.upsert({
          where: { id: "system" },
          update: {
            quickbooks_access_token: this.accessToken,
            quickbooks_refresh_token: this.refreshToken,
            quickbooks_token_expires_at: expiresAt,
            updatedAt: new Date(),
          },
          create: {
            id: "system",
            quickbooks_access_token: this.accessToken,
            quickbooks_refresh_token: this.refreshToken,
            quickbooks_token_expires_at: expiresAt,
          },
        });
        console.log("[QuickBooks] Tokens atualizados no banco de dados");
        break; // Success
      } catch (dbError: any) {
        const isPoolExhaustion = dbError?.code === "P2024" || dbError?.message?.includes("connection pool");
        if (isPoolExhaustion && dbAttempt < maxDbRetries) {
          const delay = 1000 * Math.pow(2, dbAttempt - 1);
          console.warn(`[QuickBooks] Pool exhausted saving tokens (attempt ${dbAttempt}/${maxDbRetries}). Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error(`[QuickBooks] Failed to save refreshed tokens to DB:`, dbError);
          // Tokens are refreshed in-memory even if DB save fails,
          // so current request can proceed. Log but don't throw.
          break;
        }
      }
    }
  }

  /**
   * Criar ou buscar Customer no Quickbooks
   *
   * Lookup strategy (two-phase):
   * 1. Query by PrimaryEmailAddr
   * 2. If no email match, query by DisplayName (QB's uniqueness key)
   * 3. If both miss, create new customer
   * 4. If create returns 6240 (Duplicate Name Exists), fall back to DisplayName query
   *    — handles race conditions and customers created externally without an email
   */
  async getOrCreateCustomer(data: {
    email: string;
    name: string;
    phone?: string;
    ssn?: string;
    passport?: string;
    cpf?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  }): Promise<any> {
    // Phase 1: search by email
    const emailQuery = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${data.email}'`;
    const emailResult = await this.request(`/query?query=${encodeURIComponent(emailQuery)}`);

    if (emailResult.QueryResponse?.Customer?.length > 0) {
      return emailResult.QueryResponse.Customer[0];
    }

    // Phase 2: search by DisplayName (QB uniqueness key - prevents duplicate-name errors)
    const escapedName = data.name.replace(/'/g, "\\'");
    const nameQuery = `SELECT * FROM Customer WHERE DisplayName = '${escapedName}'`;
    const nameResult = await this.request(`/query?query=${encodeURIComponent(nameQuery)}`);

    if (nameResult.QueryResponse?.Customer?.length > 0) {
      console.log(`[QuickBooks] getOrCreateCustomer: found existing customer by DisplayName "${data.name}" (email mismatch or missing in QB)`);
      return nameResult.QueryResponse.Customer[0];
    }

    // Phase 3: create new customer
    const customerData: any = {
      DisplayName: data.name,
      PrimaryEmailAddr: {
        Address: data.email,
      },
    };

    // Add phone if provided
    if (data.phone) {
      customerData.PrimaryPhone = {
        FreeFormNumber: data.phone,
      };
    }

    // Add identification documents to Notes field (QB doesn't have dedicated fields)
    const identificationNotes = [];
    if (data.ssn) identificationNotes.push(`SSN: ${data.ssn}`);
    if (data.passport) identificationNotes.push(`Passport: ${data.passport}`);
    if (data.cpf) identificationNotes.push(`CPF: ${data.cpf}`);

    if (identificationNotes.length > 0) {
      customerData.Notes = identificationNotes.join(' | ');
    }

    // Add billing address if any address data is provided
    if (data.address || data.city || data.state || data.zipCode || data.country) {
      customerData.BillAddr = {
        Line1: data.address || "No address provided",
        City: data.city || "No city",
        CountrySubDivisionCode: data.state || "",
        PostalCode: data.zipCode || "",
        Country: data.country || "USA",
      };
    } else {
      // QB requires BillAddr for email sending to work properly
      // Use minimal valid address structure when no address data provided
      customerData.BillAddr = {
        Line1: "Not Provided",
        City: "Not Provided",
        Country: "USA",
      };
    }

    try {
      const createResult = await this.request("/customer", {
        method: "POST",
        body: JSON.stringify(customerData),
      });

      return createResult.Customer;
    } catch (createError: any) {
      // Phase 4: handle 6240 "Duplicate Name Exists Error" — race condition or customer
      // created externally in QB without an email address.
      // Parse the QB Fault JSON from the error's responseText to detect code 6240.
      const responseText: string = createError?.responseText || "";
      let isDuplicateNameError = false;
      try {
        const parsed = JSON.parse(responseText);
        const errors: any[] = parsed?.Fault?.Error || [];
        isDuplicateNameError = errors.some((e: any) => String(e.code) === "6240");
      } catch {
        // responseText is not valid JSON — not a 6240 error, re-throw original
      }

      if (!isDuplicateNameError) {
        throw createError;
      }

      console.warn(`[QuickBooks] getOrCreateCustomer: received 6240 Duplicate Name error for "${data.name}". Falling back to DisplayName lookup.`);

      const fallbackResult = await this.request(`/query?query=${encodeURIComponent(nameQuery)}`);
      if (fallbackResult.QueryResponse?.Customer?.length > 0) {
        return fallbackResult.QueryResponse.Customer[0];
      }

      // If we still can't find them after a 6240, re-throw so the caller gets the original error
      throw createError;
    }
  }

  /**
   * Criar Invoice no Quickbooks
   */
  async createInvoice(data: {
    customerId: string;
    dueDate?: Date;
    docNumber?: string; // Custom invoice number
    lineItems: Array<{
      description: string;
      amount: number;
      itemRef?: string; // QuickBooks Item ID
    }>;
  }): Promise<any> {
    const invoiceData = {
      CustomerRef: {
        value: data.customerId,
      },
      DocNumber: data.docNumber, // Include custom invoice number
      TxnDate: new Date().toISOString().split("T")[0],
      DueDate: data.dueDate
        ? data.dueDate.toISOString().split("T")[0]
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
      AllowOnlineCreditCardPayment: true,
      AllowOnlineACHPayment: true,
      Line: data.lineItems.map((item) => ({
        Amount: item.amount,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: {
            value: item.itemRef || "1", // Item padrão se não informado
          },
        },
        Description: item.description,
      })),
    };

    const result = await this.request("/invoice", {
      method: "POST",
      body: JSON.stringify(invoiceData),
    });

    return result.Invoice;
  }

  /**
   * Get or create a Discount account in QuickBooks for DiscountLineDetail usage.
   * Caches the result for the lifetime of this service instance.
   */
  async getDiscountAccountRef(): Promise<{ value: string; name: string }> {
    if (this.discountAccountRef) {
      return this.discountAccountRef;
    }

    // Search for existing discount-type accounts (Income type with "discount" in name)
    const query = `SELECT Id, Name, AccountType, AccountSubType FROM Account WHERE AccountSubType = 'DiscountsRefundsGiven' MAXRESULTS 5`;
    console.log(`[QuickBooks] Searching for discount account: ${query}`);
    const result = await this.request(`/query?query=${encodeURIComponent(query)}`);
    const accounts = result.QueryResponse?.Account || [];

    if (accounts.length > 0) {
      this.discountAccountRef = { value: accounts[0].Id, name: accounts[0].Name };
      console.log(`[QuickBooks] Found discount account: ${accounts[0].Name} (ID: ${accounts[0].Id})`);
      return this.discountAccountRef;
    }

    // No discount account found — create one
    console.log(`[QuickBooks] No discount account found, creating "Discounts Given"...`);
    const createResult = await this.request("/account", {
      method: "POST",
      body: JSON.stringify({
        Name: "Discounts Given",
        AccountType: "Income",
        AccountSubType: "DiscountsRefundsGiven",
      }),
    });

    const newAccount = createResult.Account;
    this.discountAccountRef = { value: newAccount.Id, name: newAccount.Name };
    console.log(`[QuickBooks] Created discount account: ${newAccount.Name} (ID: ${newAccount.Id})`);
    return this.discountAccountRef;
  }

  /**
   * Create Invoice with BillEmail set during creation
   * Some QB configurations require email on invoice before /send works
   */
  async createInvoiceWithBillEmail(data: {
    customerId: string;
    customerEmail: string;  // REQUIRED - will be set as BillEmail
    dueDate?: Date;
    docNumber?: string;
    lineItems: Array<{
      description: string;
      amount: number;
      itemRef?: string;
    }>;
    discount?: number;  // Discount amount to apply
    billingAddress?: {
      line1?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  }): Promise<any> {
    // Build line items array, adding DiscountLineDetail if discount exists
    const invoiceLines: any[] = data.lineItems.map((item) => ({
      Amount: item.amount,
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: {
          value: item.itemRef || "1",
        },
      },
      Description: item.description,
    }));

    // Add SubTotalLine + DiscountLineDetail so QB shows Subtotal - Discount
    if (data.discount && data.discount > 0) {
      const discountAccountRef = await this.getDiscountAccountRef();
      console.log(`[QuickBooks] Adding DiscountLineDetail: -$${data.discount} (Account: ${discountAccountRef.name})`);

      // QB requires a SubTotalLine before the DiscountLineDetail
      invoiceLines.push({
        Amount: data.lineItems.reduce((sum, item) => sum + item.amount, 0),
        DetailType: "SubTotalLineDetail",
        SubTotalLineDetail: {},
      });

      invoiceLines.push({
        Amount: data.discount,
        DetailType: "DiscountLineDetail",
        DiscountLineDetail: {
          PercentBased: false,
          DiscountAccountRef: {
            value: discountAccountRef.value,
            name: discountAccountRef.name,
          },
        },
      });
    }

    const invoiceData: any = {
      CustomerRef: {
        value: data.customerId,
      },
      DocNumber: data.docNumber,
      BillEmail: {
        Address: data.customerEmail,  // SET EMAIL ON CREATION
      },
      EmailStatus: "NeedToSend",  // Tell QB this needs to be sent
      AllowOnlineCreditCardPayment: true,
      AllowOnlineACHPayment: true,
      TxnDate: new Date().toISOString().split("T")[0],
      DueDate: data.dueDate
        ? data.dueDate.toISOString().split("T")[0]
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
      Line: invoiceLines,
    };

    // Add billing address if provided
    if (data.billingAddress) {
      console.log(`[QuickBooks] Adding billing address to invoice:`, data.billingAddress);
      invoiceData.BillAddr = {
        Line1: data.billingAddress.line1 || "",
        City: data.billingAddress.city || "",
        CountrySubDivisionCode: data.billingAddress.state || "",
        PostalCode: data.billingAddress.postalCode || "",
        Country: data.billingAddress.country || "USA",
      };
    }

    console.log(`[QuickBooks] Creating invoice WITH BillEmail: ${data.customerEmail}`);
    console.log(`[QuickBooks] Invoice payload:`, JSON.stringify(invoiceData, null, 2));

    try {
      const result = await this.request("/invoice", {
        method: "POST",
        body: JSON.stringify(invoiceData),
      });

      console.log(`[QuickBooks] Created invoice ${result.Invoice?.Id} with BillEmail: ${result.Invoice?.BillEmail?.Address}`);
      console.log(`[QuickBooks] Invoice EmailStatus: ${result.Invoice?.EmailStatus}`);

      return result.Invoice;
    } catch (error: any) {
      console.error(`[QuickBooks] Invoice creation failed:`);
      console.error(`[QuickBooks] Request payload:`, JSON.stringify(invoiceData, null, 2));

      // Parse QB error response if available
      if (error.responseText) {
        try {
          const errorBody = JSON.parse(error.responseText);
          console.error(`[QuickBooks] QB Error Response:`, JSON.stringify(errorBody, null, 2));
          if (errorBody.Fault?.Error) {
            for (const err of errorBody.Fault.Error) {
              console.error(`[QuickBooks] Error ${err.code}: ${err.Message} - ${err.Detail}`);
            }
          }
        } catch {
          console.error(`[QuickBooks] Raw error text:`, error.responseText);
        }
      }
      throw error;
    }
  }

  /**
   * Update invoice to set/change BillEmail
   * Requires fetching invoice first to get SyncToken
   */
  async updateInvoiceBillEmail(invoiceId: string, email: string): Promise<any> {
    console.log(`[QuickBooks] Updating invoice ${invoiceId} BillEmail to ${email}...`);

    // First fetch the invoice to get SyncToken
    const invoiceResponse = await this.getInvoice(invoiceId);
    const invoice = invoiceResponse.Invoice;

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found in QuickBooks`);
    }

    console.log(`[QuickBooks] Current invoice EmailStatus: ${invoice.EmailStatus}`);
    console.log(`[QuickBooks] Current invoice BillEmail: ${invoice.BillEmail?.Address}`);

    // Sparse update to set BillEmail
    const updateData = {
      Id: invoice.Id,
      SyncToken: invoice.SyncToken,
      sparse: true,
      BillEmail: {
        Address: email,
      },
    };

    const result = await this.request("/invoice", {
      method: "POST",
      body: JSON.stringify(updateData),
    });

    console.log(`[QuickBooks] Updated invoice ${invoiceId}`);
    console.log(`[QuickBooks] New BillEmail: ${result.Invoice?.BillEmail?.Address}`);
    console.log(`[QuickBooks] New EmailStatus: ${result.Invoice?.EmailStatus}`);

    return result.Invoice;
  }

  /**
   * Buscar Invoice por ID
   */
  async getInvoice(invoiceId: string): Promise<any> {
    return this.request(`/invoice/${invoiceId}`);
  }

  /**
   * Enviar Invoice por email via QuickBooks (verbose version with diagnostics)
   * Uses the QB send invoice endpoint to email the invoice to the customer
   *
   * QB API requires email in POST body (not query param):
   * POST /invoice/{id}/send
   * Body: { "Id": "xxx", "BillEmail": { "Address": "email@example.com" } }
   */
  async sendInvoiceVerbose(invoiceId: string, email?: string): Promise<SendInvoiceResult> {
    const endpoint = `/invoice/${invoiceId}/send`;
    const fullUrl = `${this.baseUrl}/v3/company/${this.companyId}${endpoint}`;

    console.log(`[QB_SEND_DEBUG] === SEND INVOICE START ===`);
    console.log(`[QB_SEND_DEBUG] Invoice ID: ${invoiceId}`);
    console.log(`[QB_SEND_DEBUG] Email: ${email || 'not provided'}`);
    console.log(`[QB_SEND_DEBUG] Full endpoint URL: ${fullUrl}`);
    console.log(`[QB_SEND_DEBUG] Environment: ${process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox'}`);

    // QB API accepts email override in POST body
    const body = email ? {
      "SparseUpdate": false,
      "Id": invoiceId,
      "BillEmail": {
        "Address": email
      }
    } : undefined;

    console.log(`[QB_SEND_DEBUG] Request body: ${JSON.stringify(body, null, 2)}`);

    let httpStatus = 0;
    let responseHeaders: Record<string, string> = {};
    let rawResponse = '';
    let parsedResponse: any = null;

    try {
      // Make the request directly to capture raw response
      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      httpStatus = response.status;

      // Capture response headers
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      console.log(`[QB_SEND_DEBUG] HTTP Status: ${response.status} ${response.statusText}`);
      console.log(`[QB_SEND_DEBUG] Response Headers: ${JSON.stringify(responseHeaders, null, 2)}`);

      // Get raw response text
      rawResponse = await response.text();
      console.log(`[QB_SEND_DEBUG] Raw Response Body: ${rawResponse}`);

      // Parse JSON if possible
      try {
        parsedResponse = JSON.parse(rawResponse);
        console.log(`[QB_SEND_DEBUG] Parsed Response: ${JSON.stringify(parsedResponse, null, 2)}`);
      } catch (parseError) {
        console.log(`[QB_SEND_DEBUG] Failed to parse response as JSON: ${parseError}`);
      }

      // Check QB-specific success indicators
      const emailStatus = parsedResponse?.Invoice?.EmailStatus;
      const deliveryInfo = parsedResponse?.Invoice?.DeliveryInfo;
      const hasFault = !!parsedResponse?.Fault;
      const hasError = !!parsedResponse?.Error;
      const warnings = parsedResponse?.warnings;

      console.log(`[QB_SEND_DEBUG] EmailStatus: ${emailStatus || 'not present'}`);
      console.log(`[QB_SEND_DEBUG] DeliveryInfo: ${JSON.stringify(deliveryInfo, null, 2)}`);
      console.log(`[QB_SEND_DEBUG] Fault: ${hasFault ? JSON.stringify(parsedResponse.Fault, null, 2) : 'none'}`);
      console.log(`[QB_SEND_DEBUG] Error: ${hasError ? JSON.stringify(parsedResponse.Error, null, 2) : 'none'}`);
      console.log(`[QB_SEND_DEBUG] Warnings: ${warnings ? JSON.stringify(warnings, null, 2) : 'none'}`);

      // Determine actual success
      const success = response.ok && !hasFault && !hasError;
      console.log(`[QB_SEND_DEBUG] Determined success: ${success}`);

      return {
        success,
        httpStatus,
        emailStatus,
        qbResponse: parsedResponse,
        diagnostics: {
          endpoint: fullUrl,
          requestBody: body,
          responseHeaders,
          rawResponse,
          parsedResponse,
          hasFault,
          hasError,
          emailStatusAfter: emailStatus,
        },
      };
    } catch (error: any) {
      console.error(`[QB_SEND_DEBUG] Exception caught: ${error.message || String(error)}`);
      console.error(`[QB_SEND_DEBUG] Exception stack: ${error.stack}`);

      return {
        success: false,
        httpStatus: httpStatus || 0,
        qbResponse: parsedResponse,
        diagnostics: {
          endpoint: fullUrl,
          requestBody: body,
          responseHeaders,
          rawResponse,
          parsedResponse,
          hasFault: !!parsedResponse?.Fault,
          hasError: true,
        },
      };
    }
  }

  /**
   * Enviar Invoice por email via QuickBooks
   * Uses the QB send invoice endpoint to email the invoice to the customer
   *
   * QB API requires email in POST body (not query param):
   * POST /invoice/{id}/send
   * Body: { "Id": "xxx", "BillEmail": { "Address": "email@example.com" } }
   */
  async sendInvoice(invoiceId: string, email?: string): Promise<any> {
    // QB API Documentation for sending invoices:
    // Method 1 (Simple - uses BillEmail from invoice): POST /v3/company/{realmId}/invoice/{invoiceId}/send
    // Method 2 (With override): POST /v3/company/{realmId}/invoice/{invoiceId}/send?sendTo={emailAddr}&minorversion=75
    // Content-Type: application/octet-stream (CRITICAL)
    // Body: empty

    console.log(`[QuickBooks] Attempting to send invoice ${invoiceId}...`);
    if (email) {
      console.log(`[QuickBooks] Override email: ${email}`);
    }

    // Retry logic: 2 attempts with 1s delay
    const maxAttempts = 2;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (!this.accessToken) {
          throw new Error("Quickbooks access token not configured");
        }

        if (!this.companyId || this.companyId.trim() === "") {
          throw new Error("Quickbooks company ID not configured");
        }

        console.log(`[QuickBooks] Send attempt ${attempt}/${maxAttempts}`);

        // If this is a retry (attempt > 1), try updating BillEmail first
        if (attempt > 1 && email) {
          console.log(`[QuickBooks] Retry attempt - updating BillEmail to ${email} before send`);
          try {
            await this.updateInvoiceBillEmail(invoiceId, email);
            console.log(`[QuickBooks] BillEmail updated successfully`);
          } catch (updateError: any) {
            console.warn(`[QuickBooks] Failed to update BillEmail on retry:`, updateError.message);
            // Continue with send attempt anyway
          }
        }

        // Build endpoint - use Method 2 if explicit email provided, otherwise Method 1
        let endpoint = `/invoice/${invoiceId}/send`;
        if (email) {
          endpoint += `?sendTo=${encodeURIComponent(email)}&minorversion=75`;
          console.log(`[QuickBooks] Using Method 2 (explicit email with minorversion=75)`);
        } else {
          console.log(`[QuickBooks] Using Method 1 (BillEmail from invoice)`);
        }

        const url = `${this.baseUrl}/v3/company/${this.companyId}${endpoint}`;
        console.log(`[QuickBooks] Calling: POST ${url}`);

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.accessToken}`,
            "Accept": "application/json",
            "Content-Type": "application/octet-stream",  // CRITICAL: Per QB API docs
          },
          body: "",  // Empty body as per QB API documentation
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[QuickBooks] API Error ${response.status}: ${errorText}`);
          throw new Error(`QB /send failed (${response.status}): ${errorText}`);
        }

        const result = await response.json();

        console.log(`[QuickBooks] ✓ Invoice ${invoiceId} sent successfully on attempt ${attempt}`);
        console.log(`[QuickBooks] EmailStatus: ${result.Invoice?.EmailStatus}`);
        console.log(`[QuickBooks] DeliveryInfo:`, JSON.stringify(result.Invoice?.DeliveryInfo, null, 2));

        return {
          success: true,
          sent: true,
          emailStatus: result.Invoice?.EmailStatus,
          deliveryInfo: result.Invoice?.DeliveryInfo,
          attempt,
          result
        };
      } catch (error: any) {
        lastError = error;
        console.error(`[QuickBooks] ✗ Send attempt ${attempt}/${maxAttempts} failed:`, error.message || String(error));

        // If not last attempt, wait 1s before retry
        if (attempt < maxAttempts) {
          console.log(`[QuickBooks] Waiting 1s before retry...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // All attempts failed
    console.error(`[QuickBooks] ✗ All ${maxAttempts} send attempts failed for invoice ${invoiceId}`);
    console.error(`[QuickBooks] Last error:`, lastError?.message || String(lastError));

    // Log but don't throw - allow invoice creation to complete
    // The invoice is already set to NeedToSend, QB will batch-send it automatically
    return {
      success: false,
      sent: false,
      emailStatus: "NeedToSend",
      error: lastError?.message || String(lastError),
      attempts: maxAttempts,
      note: "Invoice created successfully and marked NeedToSend. QB will batch-send automatically. Immediate send via /send endpoint failed after retries."
    };
  }

  /**
   * Listar Items de serviço no QuickBooks
   * Inclui: Service, NonInventory, e outros tipos usáveis para faturamento
   */
  async getServiceItems(): Promise<
    Array<{
      id: string;
      name: string;
      description?: string;
      unitPrice?: number;
      type?: string;
    }>
  > {
    // Modo demo: se QuickBooks não estiver configurado, retornar itens mock
    if (!this.accessToken || !this.companyId || this.companyId.trim() === "") {
      console.warn(
        "[QuickBooks] Access token ou companyId não configurados. Retornando itens de serviço mock para modo de desenvolvimento."
      );
      return [
        {
          id: "demo-service-1",
          name: "Serviço Demo - Consultoria",
          description: "Item de serviço fictício para testes (QuickBooks não configurado)",
          unitPrice: 1000,
          type: "Service",
        },
        {
          id: "demo-service-2",
          name: "Serviço Demo - Assessoria",
          description: "Item de serviço fictício para testes (QuickBooks não configurado)",
          unitPrice: 500,
          type: "Service",
        },
      ];
    }

    try {
      // First, try to get all active items (not just Service/NonInventory)
      // This ensures we get items regardless of their type
      const query = `SELECT Id, Name, Description, UnitPrice, Type FROM Item WHERE Active = true MAXRESULTS 1000`;
      console.log(`[QuickBooks] Fetching all items: ${query}`);
      const result = await this.request(`/query?query=${encodeURIComponent(query)}`);

      console.log(`[QuickBooks] Raw items response:`, JSON.stringify(result?.QueryResponse, null, 2).substring(0, 500));

      let items = result.QueryResponse?.Item || [];

      // Handle single item response
      if (!Array.isArray(items) && items.Id) {
        items = [items];
      }

      // Filter to usable item types for invoicing (exclude system types like SalesTax, etc.)
      // QuickBooks item types that can be used on invoices:
      // - Service: Service items
      // - NonInventory: Non-inventory items (products that don't track quantity)
      // - Inventory: Inventory items (products that track quantity)
      // - Group: Bundle/group items
      // - Bundle: Also bundle items in some QB versions
      // - null/undefined: Items without explicit type (allow them)
      const usableTypes = ['Service', 'NonInventory', 'Inventory', 'Group', 'Bundle', 'Product', 'InventoryPart'];
      const filteredItems = items.filter((item: any) => {
        // Allow items without a type or with usable type
        const isUsable = !item.Type || usableTypes.includes(item.Type);
        if (!isUsable) {
          console.log(`[QuickBooks] Skipping item ${item.Name} with type ${item.Type}`);
        }
        return isUsable;
      });

      console.log(`[QuickBooks] Found ${items.length} total items, ${filteredItems.length} usable for invoicing`);

      // If no items found, log more details
      if (filteredItems.length === 0) {
        console.warn(`[QuickBooks] No usable items found. Item types present: ${[...new Set(items.map((i: any) => i.Type))].join(', ')}`);
      }

      return filteredItems.map((item: any) => ({
        id: item.Id,
        name: item.Name,
        description: item.Description,
        unitPrice: item.UnitPrice,
        type: item.Type,
      }));
    } catch (error: any) {
      console.error(`[QuickBooks] Error fetching items:`, error.message);
      throw error;
    }
  }

  /**
   * Buscar todos os Customers do QuickBooks
   */
  async getAllCustomers(maxResults: number = 1000): Promise<any[]> {
    const query = `SELECT * FROM Customer WHERE Active = true MAXRESULTS ${maxResults}`;
    console.log(`[QuickBooks] Executando query: ${query}`);
    const result = await this.request(`/query?query=${encodeURIComponent(query)}`);
    console.log(`[QuickBooks] Resposta da query Customer:`, JSON.stringify(result, null, 2));
    
    const customers = result.QueryResponse?.Customer || [];
    console.log(`[QuickBooks] Total de customers encontrados: ${customers.length}`);
    
    // Se não houver customers no array, pode ser que venha como objeto único
    if (!Array.isArray(customers) && customers.Id) {
      return [customers];
    }
    
    return customers;
  }

  /**
   * Buscar Customer por ID no QuickBooks
   */
  async getCustomerById(customerId: string): Promise<any> {
    return this.request(`/customer/${customerId}`);
  }

  /**
   * Buscar todos os Customers com paginação (para bulk imports)
   * QuickBooks limita queries a 1000 resultados por vez
   */
  async getAllCustomersPaginated(options?: {
    startPosition?: number;
  }): Promise<{ customers: any[]; hasMore: boolean; nextPosition: number }> {
    const maxResults = 1000; // QB API max
    const startPosition = options?.startPosition || 1;

    const query = `SELECT * FROM Customer WHERE Active = true STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
    console.log(`[QuickBooks API] Query: ${query}`);
    console.log(`[QuickBooks API] Requesting from position ${startPosition}, max ${maxResults} results`);

    const result = await this.request(`/query?query=${encodeURIComponent(query)}`);

    // Log the raw response structure
    console.log(`[QuickBooks API] Response keys:`, Object.keys(result.QueryResponse || {}));
    console.log(`[QuickBooks API] Raw response metadata:`, JSON.stringify({
      maxResults: result.QueryResponse?.maxResults,
      startPosition: result.QueryResponse?.startPosition,
      totalCount: result.QueryResponse?.totalCount,
    }));

    let customers = result.QueryResponse?.Customer || [];

    // Se não houver customers no array, pode ser que venha como objeto único
    if (!Array.isArray(customers) && customers.Id) {
      console.log(`[QuickBooks API] Single customer returned (not array), converting to array`);
      customers = [customers];
    }

    const count = customers.length;
    const hasMore = count === maxResults; // If we got exactly maxResults, there might be more
    const nextPosition = startPosition + count;

    console.log(`[QuickBooks API] ━━━ Pagination Result ━━━`);
    console.log(`[QuickBooks API] → Customers returned: ${count}`);
    console.log(`[QuickBooks API] → Has more pages: ${hasMore} (${count} === ${maxResults})`);
    console.log(`[QuickBooks API] → Next position: ${nextPosition}`);
    console.log(`[QuickBooks API] → First customer ID: ${customers[0]?.Id || 'N/A'}`);
    console.log(`[QuickBooks API] → Last customer ID: ${customers[count - 1]?.Id || 'N/A'}`);

    return {
      customers,
      hasMore,
      nextPosition,
    };
  }

  /**
   * Buscar todas as Invoices do QuickBooks
   */
  async getAllInvoices(maxResults: number = 1000, startPosition?: number): Promise<{
    invoices: any[];
    maxResults: number;
    startPosition: number;
  }> {
    let query = `SELECT * FROM Invoice MAXRESULTS ${maxResults}`;
    if (startPosition) {
      query += ` STARTPOSITION ${startPosition}`;
    }
    
    console.log(`[QuickBooks] Executando query: ${query}`);
    const result = await this.request(`/query?query=${encodeURIComponent(query)}`);
    console.log(`[QuickBooks] Resposta da query Invoice:`, JSON.stringify(result, null, 2));
    
    let invoices = result.QueryResponse?.Invoice || [];
    console.log(`[QuickBooks] Total de invoices encontradas: ${invoices.length}`);
    
    // Se não houver invoices no array, pode ser que venha como objeto único
    if (!Array.isArray(invoices) && invoices.Id) {
      invoices = [invoices];
    }
    
    return {
      invoices,
      maxResults: result.QueryResponse?.maxResults || maxResults,
      startPosition: result.QueryResponse?.startPosition || 0,
    };
  }

  /**
   * Buscar todas as Invoices com paginação (para bulk imports)
   * QuickBooks limita queries a 1000 resultados por vez
   */
  async getAllInvoicesPaginated(options?: {
    startPosition?: number;
  }): Promise<{ invoices: any[]; hasMore: boolean; nextPosition: number }> {
    const maxResults = 1000; // QB API max
    const startPosition = options?.startPosition || 1;

    const query = `SELECT * FROM Invoice STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
    console.log(`[QuickBooks API] Query: ${query}`);
    console.log(`[QuickBooks API] Requesting from position ${startPosition}, max ${maxResults} results`);

    const result = await this.request(`/query?query=${encodeURIComponent(query)}`);

    // Log the raw response structure
    console.log(`[QuickBooks API] Response keys:`, Object.keys(result.QueryResponse || {}));
    console.log(`[QuickBooks API] Raw response metadata:`, JSON.stringify({
      maxResults: result.QueryResponse?.maxResults,
      startPosition: result.QueryResponse?.startPosition,
      totalCount: result.QueryResponse?.totalCount,
    }));

    let invoices = result.QueryResponse?.Invoice || [];

    // Se não houver invoices no array, pode ser que venha como objeto único
    if (!Array.isArray(invoices) && invoices.Id) {
      console.log(`[QuickBooks API] Single invoice returned (not array), converting to array`);
      invoices = [invoices];
    }

    const count = invoices.length;
    const hasMore = count === maxResults; // If we got exactly maxResults, there might be more
    const nextPosition = startPosition + count;

    console.log(`[QuickBooks API] ━━━ Pagination Result ━━━`);
    console.log(`[QuickBooks API] → Invoices returned: ${count}`);
    console.log(`[QuickBooks API] → Has more pages: ${hasMore} (${count} === ${maxResults})`);
    console.log(`[QuickBooks API] → Next position: ${nextPosition}`);
    console.log(`[QuickBooks API] → First invoice ID: ${invoices[0]?.Id || 'N/A'}`);
    console.log(`[QuickBooks API] → Last invoice ID: ${invoices[count - 1]?.Id || 'N/A'}`);

    return {
      invoices,
      hasMore,
      nextPosition,
    };
  }

  /**
   * Buscar Invoices por status
   */
  async getInvoicesByStatus(
    status: "Draft" | "Pending" | "Paid" | "Void",
    maxResults: number = 1000
  ): Promise<any[]> {
    const query = `SELECT * FROM Invoice WHERE DocNumber != '' AND TxnStatus = '${status}' MAXRESULTS ${maxResults}`;
    console.log(`[QuickBooks] Executando query: ${query}`);
    const result = await this.request(`/query?query=${encodeURIComponent(query)}`);
    console.log(`[QuickBooks] Resposta da query Invoice por status:`, JSON.stringify(result, null, 2));
    
    let invoices = result.QueryResponse?.Invoice || [];
    
    // Se não houver invoices no array, pode ser que venha como objeto único
    if (!Array.isArray(invoices) && invoices.Id) {
      invoices = [invoices];
    }
    
    return invoices;
  }

  /**
   * Buscar Payments do QuickBooks
   */
  async getAllPayments(maxResults: number = 1000): Promise<any[]> {
    const query = `SELECT * FROM Payment MAXRESULTS ${maxResults}`;
    const result = await this.request(`/query?query=${encodeURIComponent(query)}`);
    return result.QueryResponse?.Payment || [];
  }

  /**
   * Buscar Payments relacionados a uma Invoice
   */
  async getPaymentsByInvoice(invoiceId: string): Promise<any[]> {
    const query = `SELECT * FROM Payment WHERE Line.LinkedTxn.TxnId = '${invoiceId}'`;
    const result = await this.request(`/query?query=${encodeURIComponent(query)}`);
    return result.QueryResponse?.Payment || [];
  }

  /**
   * Create Payment in QuickBooks
   * Records a payment against an invoice
   */
  async createPayment(data: {
    customerId: string;
    invoiceId: string;
    amount: number;
    paymentDate?: Date;
    paymentMethod?: string;
    referenceNumber?: string;
  }): Promise<any> {
    const paymentData = {
      CustomerRef: {
        value: data.customerId,
      },
      TotalAmt: data.amount,
      TxnDate: (data.paymentDate || new Date()).toISOString().split("T")[0],
      PrivateNote: data.referenceNumber ? `Stripe Payment: ${data.referenceNumber}` : undefined,
      Line: [
        {
          Amount: data.amount,
          LinkedTxn: [
            {
              TxnId: data.invoiceId,
              TxnType: "Invoice",
            },
          ],
        },
      ],
    };

    const result = await this.request("/payment", {
      method: "POST",
      body: JSON.stringify(paymentData),
    });

    console.log(`[QuickBooks] Payment created: ${result.Payment?.Id}`);
    return result.Payment;
  }

  /**
   * Buscar todos os Items do QuickBooks
   */
  async getAllItems(maxResults: number = 1000): Promise<any[]> {
    const query = `SELECT * FROM Item WHERE Active = true MAXRESULTS ${maxResults}`;
    console.log(`[QuickBooks] Executando query: ${query}`);
    const result = await this.request(`/query?query=${encodeURIComponent(query)}`);
    console.log(`[QuickBooks] Resposta da query Item:`, JSON.stringify(result, null, 2));

    let items = result.QueryResponse?.Item || [];
    console.log(`[QuickBooks] Total de items encontrados: ${items.length}`);

    // Se não houver items no array, pode ser que venha como objeto único
    if (!Array.isArray(items) && items.Id) {
      items = [items];
    }

    return items;
  }

  /**
   * Buscar todos os Price Levels do QuickBooks
   * 
   * Note: PriceLevel entity is not available in all QuickBooks editions:
   * - QuickBooks Simple Start: Does NOT support price levels
   * - QuickBooks Essentials: Does NOT support price levels
   * - QuickBooks Plus: Supports price levels
   * - QuickBooks Advanced: Supports price levels
   * 
   * If the account doesn't have PriceLevel enabled, returns empty array instead of throwing.
   * 
   * IMPORTANT: This method bypasses the standard request() method to avoid logging errors
   * for unsupported entities. This prevents pollution of IntegrationLog with expected errors.
   */
  async getPriceLevels(maxResults: number = 1000): Promise<any[]> {
    const query = `SELECT * FROM PriceLevel WHERE Active = true MAXRESULTS ${maxResults}`;
    
    // Direct fetch to avoid error logging for unsupported entities
    if (!this.accessToken || !this.companyId || this.companyId.trim() === "") {
      console.warn(`[QuickBooks] Cannot query PriceLevel - missing credentials`);
      return [];
    }

    const url = `${this.baseUrl}/v3/company/${this.companyId}/query?query=${encodeURIComponent(query)}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Check if error is "Metadata not found for Entity: PriceLevel"
        const isPriceLevelNotSupported = 
          errorText.includes("Metadata not found for Entity: PriceLevel");
        
        if (response.status === 400 && isPriceLevelNotSupported) {
          console.log(`[QuickBooks] PriceLevel entity not supported in this QuickBooks account (Simple Start/Essentials edition). Returning empty array.`);
          return [];
        }
        
        // For other errors, use standard request method to get proper error handling
        console.error(`[QuickBooks] Unexpected error querying PriceLevel: ${response.status} ${errorText}`);
        throw new Error(`QuickBooks PriceLevel query failed: ${response.status}`);
      }

      const result = await response.json();
      let priceLevels = result.QueryResponse?.PriceLevel || [];

      // Se não houver price levels no array, pode ser que venha como objeto único
      if (!Array.isArray(priceLevels) && priceLevels.Id) {
        priceLevels = [priceLevels];
      }

      console.log(`[QuickBooks] Found ${priceLevels.length} price levels`);
      return priceLevels;
    } catch (error: any) {
      // Silent failure for unsupported entity - already logged above
      console.warn(`[QuickBooks] PriceLevel query skipped (entity not supported)`);
      return [];
    }
  }

  /**
   * Buscar todos os Payment Terms (Terms) do QuickBooks
   */
  async getPaymentTerms(maxResults: number = 1000): Promise<any[]> {
    const query = `SELECT * FROM Term WHERE Active = true MAXRESULTS ${maxResults}`;
    console.log(`[QuickBooks] Executando query: ${query}`);
    const result = await this.request(`/query?query=${encodeURIComponent(query)}`);
    console.log(`[QuickBooks] Resposta da query Term:`, JSON.stringify(result, null, 2));

    let terms = result.QueryResponse?.Term || [];
    console.log(`[QuickBooks] Total de payment terms encontrados: ${terms.length}`);

    // Se não houver terms no array, pode ser que venha como objeto único
    if (!Array.isArray(terms) && terms.Id) {
      terms = [terms];
    }

    return terms;
  }

  /**
   * Buscar informações da Company
   */
  async getCompanyInfo(): Promise<any> {
    return this.request(`/companyinfo/${this.companyId}`);
  }

  /**
   * Update customer email in QuickBooks
   * Requires reading customer first to get SyncToken
   */
  async updateCustomerEmail(customerId: string, email: string): Promise<any> {
    console.log(`[QuickBooks] Updating customer ${customerId} email to ${email}...`);

    // Read current customer to get SyncToken (required for updates)
    const customer = await this.getCustomerById(customerId);

    if (!customer) {
      throw new Error(`Customer ${customerId} not found in QuickBooks`);
    }

    // Update customer with new email
    const updateData = {
      Id: customer.Customer.Id,
      SyncToken: customer.Customer.SyncToken,
      PrimaryEmailAddr: {
        Address: email,
      },
    };

    const result = await this.request("/customer", {
      method: "POST",
      body: JSON.stringify(updateData),
    });

    console.log(`[QuickBooks] ✓ Customer ${customerId} email updated successfully`);
    return result.Customer;
  }

  /**
   * Update customer information in QuickBooks
   * Requires reading customer first to get SyncToken
   */
  async updateCustomer(
    customerId: string,
    updates: {
      name?: string;
      phone?: string;
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string;
    }
  ): Promise<any> {
    console.log(`[QuickBooks] Updating customer ${customerId}...`, updates);

    // Read current customer to get SyncToken (required for updates)
    const customerResponse = await this.getCustomerById(customerId);

    if (!customerResponse || !customerResponse.Customer) {
      throw new Error(`Customer ${customerId} not found in QuickBooks`);
    }

    const customer = customerResponse.Customer;

    // Build update data with sparse update pattern (only changed fields)
    const updateData: any = {
      Id: customer.Id,
      SyncToken: customer.SyncToken,
    };

    // Update name fields if provided
    if (updates.name) {
      // Parse name into GivenName and FamilyName
      // Split by last space: "John Smith Jr" -> GivenName="John Smith", FamilyName="Jr"
      const nameParts = updates.name.trim().split(/\s+/);

      if (nameParts.length === 1) {
        // Only one word, use it as both GivenName and FamilyName
        updateData.GivenName = nameParts[0];
        updateData.FamilyName = nameParts[0];
      } else {
        // Multiple words: last word is FamilyName, rest is GivenName
        updateData.FamilyName = nameParts[nameParts.length - 1];
        updateData.GivenName = nameParts.slice(0, -1).join(" ");
      }

      updateData.DisplayName = updates.name;
    }

    // Update phone if provided
    if (updates.phone) {
      updateData.PrimaryPhone = {
        FreeFormNumber: updates.phone,
      };
    }

    // Update billing address if any address field provided
    if (updates.address || updates.city || updates.state || updates.zipCode) {
      updateData.BillAddr = {
        Line1: updates.address || customer.BillAddr?.Line1 || "",
        City: updates.city || customer.BillAddr?.City || "",
        CountrySubDivisionCode: updates.state || customer.BillAddr?.CountrySubDivisionCode || "",
        PostalCode: updates.zipCode || customer.BillAddr?.PostalCode || "",
      };
    }

    const result = await this.request("/customer", {
      method: "POST",
      body: JSON.stringify(updateData),
    });

    console.log(`[QuickBooks] ✓ Customer ${customerId} updated successfully`);
    return result.Customer;
  }

  /**
   * Ensure customer has correct email in QuickBooks
   * Checks if email matches, updates if different
   * Returns true if email was correct or successfully updated
   */
  async ensureCustomerEmail(customerId: string, email: string): Promise<boolean> {
    try {
      console.log(`[QuickBooks] Verifying customer ${customerId} has email ${email}...`);

      // Get current customer data
      const customerResponse = await this.getCustomerById(customerId);
      const customer = customerResponse.Customer;

      if (!customer) {
        console.error(`[QuickBooks] Customer ${customerId} not found`);
        return false;
      }

      // Check current email
      const currentEmail = customer.PrimaryEmailAddr?.Address;

      if (currentEmail === email) {
        console.log(`[QuickBooks] ✓ Customer ${customerId} already has correct email: ${email}`);
        return true;
      }

      // Email is different or missing, update it
      console.log(`[QuickBooks] Customer ${customerId} email mismatch: "${currentEmail}" !== "${email}", updating...`);
      await this.updateCustomerEmail(customerId, email);

      console.log(`[QuickBooks] ✓ Customer ${customerId} email updated from "${currentEmail}" to "${email}"`);
      return true;
    } catch (error) {
      console.error(`[QuickBooks] Error ensuring customer email for ${customerId}:`, error);
      return false;
    }
  }

  /**
   * Buscar Invoice por número de documento
   */
  async getInvoiceByDocNumber(docNumber: string): Promise<any> {
    const query = `SELECT * FROM Invoice WHERE DocNumber = '${docNumber}'`;
    const result = await this.request(`/query?query=${encodeURIComponent(query)}`);
    const invoices = result.QueryResponse?.Invoice || [];
    return invoices.length > 0 ? invoices[0] : null;
  }

  /**
   * Buscar Invoices por Customer ID
   */
  async getInvoicesByCustomer(customerId: string, maxResults: number = 1000): Promise<any[]> {
    const query = `SELECT * FROM Invoice WHERE CustomerRef = '${customerId}' MAXRESULTS ${maxResults}`;
    const result = await this.request(`/query?query=${encodeURIComponent(query)}`);
    return result.QueryResponse?.Invoice || [];
  }

  /**
   * Buscar Invoices por período
   */
  async getInvoicesByDateRange(
    startDate: string,
    endDate: string,
    maxResults: number = 1000
  ): Promise<any[]> {
    const query = `SELECT * FROM Invoice WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' MAXRESULTS ${maxResults}`;
    const result = await this.request(`/query?query=${encodeURIComponent(query)}`);
    return result.QueryResponse?.Invoice || [];
  }

  /**
   * Public method to refresh QuickBooks access token
   * Used by cron jobs and manual refresh endpoints
   * Throws if refresh fails - caller should handle errors
   */
  async refreshAccessTokenDirect(): Promise<void> {
    return this.refreshAccessToken();
  }

  /**
   * Void Invoice in QuickBooks
   * QuickBooks does not support hard delete for invoices.
   * Instead, we void them which sets balance to $0 and marks as voided.
   * Requires full invoice object with SyncToken.
   */
  async voidInvoice(invoiceId: string): Promise<any> {
    try {
      console.log(`[QuickBooks] Fetching invoice ${invoiceId} for voiding...`);

      // First fetch full invoice (QB requires full object for void operation)
      const invoiceResponse = await this.getInvoice(invoiceId);
      const invoice = invoiceResponse.Invoice;

      if (!invoice) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }

      console.log(`[QuickBooks] Invoice SyncToken: ${invoice.SyncToken}`);

      console.log(`[QuickBooks] Voiding invoice ${invoiceId}...`);
      const result = await this.request(`/invoice?operation=void`, {
        method: "POST",
        body: JSON.stringify(invoice),
      });

      console.log(`[QuickBooks] ✓ Invoice ${invoiceId} voided successfully`);
      return result;
    } catch (error: any) {
      console.error(`[QuickBooks] ✗ Failed to void invoice ${invoiceId}:`, error.message || String(error));
      throw error;
    }
  }

  /**
   * Delete Customer from QuickBooks
   * Requires SyncToken from the customer
   */
  async deleteCustomer(customerId: string): Promise<any> {
    try {
      console.log(`[QuickBooks] Fetching customer ${customerId} for deletion...`);

      // First fetch customer to get SyncToken
      const customerResponse = await this.getCustomerById(customerId);
      const customer = customerResponse.Customer;

      if (!customer) {
        throw new Error(`Customer ${customerId} not found`);
      }

      console.log(`[QuickBooks] Customer SyncToken: ${customer.SyncToken}`);

      // Prepare delete payload
      const deletePayload = {
        Id: customerId,
        SyncToken: customer.SyncToken,
      };

      console.log(`[QuickBooks] Deleting customer ${customerId}...`);
      const result = await this.request(`/customer`, {
        method: "POST",
        body: JSON.stringify(deletePayload),
        headers: {
          "X-QB-Operation": "Delete",
        },
      });

      console.log(`[QuickBooks] ✓ Customer ${customerId} deleted successfully`);
      return result;
    } catch (error: any) {
      console.error(`[QuickBooks] ✗ Failed to delete customer ${customerId}:`, error.message || String(error));
      throw error;
    }
  }

  /**
   * Update Invoice in QuickBooks using sparse update
   * QuickBooks sparse update pattern:
   * - POST to /v3/company/{realmId}/invoice?minorversion=73
   * - Body includes: { sparse: true, ...changed_fields, SyncToken, Id }
   * - Must fetch current invoice first to get SyncToken
   * - SyncToken increments with each update (prevents concurrent update conflicts)
   * - Only include fields being changed
   */
  async updateInvoice(
    quickbooksInvoiceId: string,
    updates: {
      amount?: number;
      dueDate?: string; // YYYY-MM-DD format
      description?: string;
      lineItems?: Array<{
        description: string;
        amount: number;
        detailType?: string;
        accountRef?: { value: string };
      }>;
    }
  ): Promise<any> {
    try {
      console.log(`[QuickBooks] Updating invoice ${quickbooksInvoiceId} with sparse update...`);

      // 1. Fetch current invoice to get SyncToken
      const invoiceResponse = await this.getInvoice(quickbooksInvoiceId);
      const invoice = invoiceResponse.Invoice;

      if (!invoice) {
        throw new Error(`Invoice ${quickbooksInvoiceId} not found in QuickBooks`);
      }

      console.log(`[QuickBooks] Current invoice SyncToken: ${invoice.SyncToken}`);

      // 2. Build sparse update object with only changed fields
      const updateData: any = {
        Id: invoice.Id,
        SyncToken: invoice.SyncToken,
        sparse: true,
      };

      // Add changed fields
      if (updates.dueDate !== undefined) {
        updateData.DueDate = updates.dueDate;
        console.log(`[QuickBooks] Updating DueDate to: ${updates.dueDate}`);
      }

      if (updates.description !== undefined) {
        updateData.CustomerMemo = {
          value: updates.description,
        };
        console.log(`[QuickBooks] Updating description`);
      }

      if (updates.lineItems !== undefined && updates.lineItems.length > 0) {
        // Map line items to QuickBooks format
        updateData.Line = updates.lineItems.map((item) => ({
          Amount: item.amount,
          DetailType: "SalesItemLineDetail",
          Description: item.description,
          SalesItemLineDetail: {
            ItemRef: {
              value: item.accountRef?.value || "1", // Use default service item
            },
          },
        }));
        console.log(`[QuickBooks] Updating ${updates.lineItems.length} line items`);
      }

      // Note: Amount is calculated from line items in QuickBooks, not set directly

      // 3. POST to /v3/company/{realmId}/invoice?minorversion=73
      console.log(`[QuickBooks] Sending sparse update...`);
      const result = await this.request("/invoice?minorversion=73", {
        method: "POST",
        body: JSON.stringify(updateData),
      });

      console.log(`[QuickBooks] ✓ Invoice ${quickbooksInvoiceId} updated successfully`);
      console.log(`[QuickBooks] New SyncToken: ${result.Invoice?.SyncToken}`);

      // 4. Log to IntegrationLog
      await prisma.integrationLog.create({
        data: {
          service: "quickbooks",
          action: "invoice_updated",
          status: "SUCCESS",
          payload: {
            quickbooks_invoice_id: quickbooksInvoiceId,
            updates,
            newSyncToken: result.Invoice?.SyncToken,
          },
        },
      });

      // 5. Return updated invoice
      return result.Invoice;
    } catch (error: any) {
      console.error(`[QuickBooks] ✗ Failed to update invoice ${quickbooksInvoiceId}:`, error.message || String(error));

      // Log error to IntegrationLog
      await prisma.integrationLog.create({
        data: {
          service: "quickbooks",
          action: "invoice_update_failed",
          status: "ERROR",
          error: error.message || String(error),
          payload: {
            quickbooks_invoice_id: quickbooksInvoiceId,
            updates,
          },
        },
      });

      throw error;
    }
  }
}

export const quickbooksService = new QuickbooksService();

