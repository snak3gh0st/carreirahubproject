import { prisma } from "@/lib/db";
import { CircuitBreaker, CircuitOpenError } from "@/lib/utils/circuit-breaker";

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
   * DEVE ser chamado antes de usar o serviço
   */
  async initialize(): Promise<void> {
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
          "[QuickBooks] Nenhuma configuração encontrada no banco. Use /api/quickbooks/auth/connect para autenticar."
        );
      }
    } catch (error) {
      console.error("[QuickBooks] Erro ao carregar tokens:", error);
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
    try {
      return await this.circuitBreaker.execute(async () => {
        if (!this.accessToken) {
          throw new Error("Quickbooks access token not configured");
        }

        if (!this.companyId || this.companyId.trim() === "") {
          throw new Error("Quickbooks company ID not configured");
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
          throw new Error(`Quickbooks API error (${response.status}): ${response.statusText} - ${errorText}`);
        }

        return response.json();
      });
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        // Circuit is open - return null/fallback
        console.warn(`[QuickBooks] Circuit breaker open: ${error.message}`);
        // Log to integration log
        await prisma.integrationLog.create({
          data: {
            service: "quickbooks",
            action: endpoint,
            status: "CIRCUIT_OPEN",
            payload: { endpoint, method: options.method || "GET" },
            error: error.message,
          },
        }).catch(err => console.error("[QuickBooks] Failed to log circuit open:", err));
        return null;
      }
      throw error;
    }
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
    const expiresIn = data.expires_in || 3600; // padrão 1 hora
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

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
  }

  /**
   * Criar ou buscar Customer no Quickbooks
   */
  async getOrCreateCustomer(data: {
    email: string;
    name: string;
    phone?: string;
  }): Promise<any> {
    // Buscar customer existente
    const query = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${data.email}'`;
    const searchResult = await this.request(`/query?query=${encodeURIComponent(query)}`);

    if (searchResult.QueryResponse?.Customer?.length > 0) {
      return searchResult.QueryResponse.Customer[0];
    }

    // Criar novo customer
    const customerData = {
      DisplayName: data.name,
      PrimaryEmailAddr: {
        Address: data.email,
      },
      ...(data.phone && {
        PrimaryPhone: {
          FreeFormNumber: data.phone,
        },
      }),
    };

    const createResult = await this.request("/customer", {
      method: "POST",
      body: JSON.stringify(customerData),
    });

    return createResult.Customer;
  }

  /**
   * Criar Invoice no Quickbooks
   */
  async createInvoice(data: {
    customerId: string;
    dueDate?: Date;
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
      TxnDate: new Date().toISOString().split("T")[0],
      DueDate: data.dueDate
        ? data.dueDate.toISOString().split("T")[0]
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
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
   * Buscar Invoice por ID
   */
  async getInvoice(invoiceId: string): Promise<any> {
    return this.request(`/invoice/${invoiceId}`);
  }

  /**
   * Enviar Invoice por email
   */
  async sendInvoice(invoiceId: string, email?: string): Promise<any> {
    return this.request(`/invoice/${invoiceId}/send`, {
      method: "POST",
      body: JSON.stringify({
        Email: {
          To: email,
        },
      }),
    });
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
    console.log(`[QuickBooks] Executando query com paginação: ${query}`);
    const result = await this.request(`/query?query=${encodeURIComponent(query)}`);

    let customers = result.QueryResponse?.Customer || [];

    // Se não houver customers no array, pode ser que venha como objeto único
    if (!Array.isArray(customers) && customers.Id) {
      customers = [customers];
    }

    const count = customers.length;
    const hasMore = count === maxResults; // If we got exactly maxResults, there might be more
    const nextPosition = startPosition + count;

    console.log(`[QuickBooks] Customers: ${count} encontrados, hasMore: ${hasMore}, nextPosition: ${nextPosition}`);

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
    console.log(`[QuickBooks] Executando query com paginação: ${query}`);
    const result = await this.request(`/query?query=${encodeURIComponent(query)}`);

    let invoices = result.QueryResponse?.Invoice || [];

    // Se não houver invoices no array, pode ser que venha como objeto único
    if (!Array.isArray(invoices) && invoices.Id) {
      invoices = [invoices];
    }

    const count = invoices.length;
    const hasMore = count === maxResults; // If we got exactly maxResults, there might be more
    const nextPosition = startPosition + count;

    console.log(`[QuickBooks] Invoices: ${count} encontradas, hasMore: ${hasMore}, nextPosition: ${nextPosition}`);

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
   * Buscar informações da Company
   */
  async getCompanyInfo(): Promise<any> {
    return this.request("/companyinfo");
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
}

export const quickbooksService = new QuickbooksService();

