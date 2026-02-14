/**
 * Pipedrive Service
 *
 * Responsabilidade: Integração com Pipedrive API
 */
import { CircuitBreaker, CircuitOpenError } from "@/lib/utils/circuit-breaker";
import { integrationLogger, StructuredErrorData } from "@/lib/utils/logger";
import { prisma } from "@/lib/db";

export class PipedriveService {
  private apiToken: string;
  private companyDomain: string;
  private baseUrl: string;
  private circuitBreaker: CircuitBreaker;

  constructor() {
    this.apiToken = process.env.PIPEDRIVE_API_TOKEN || "";
    this.companyDomain = process.env.PIPEDRIVE_COMPANY_DOMAIN || "";
    this.baseUrl = `https://${this.companyDomain}.pipedrive.com/api/v1`;
    this.circuitBreaker = new CircuitBreaker("pipedrive");
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const startTime = Date.now();
    try {
      return await this.circuitBreaker.execute(async () => {
        const url = `${this.baseUrl}${endpoint}?api_token=${this.apiToken}`;

        const response = await fetch(url, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            ...options.headers,
          },
        });

        if (!response.ok) {
          const error: any = new Error(`Pipedrive API error: ${response.statusText}`);
          error.status = response.status;
          throw error;
        }

        const data = await response.json();
        return data.data || data;
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
          "pipedrive",
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
        },
      };

      await integrationLogger.logError(
        "pipedrive",
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
   * Buscar Person por ID
   */
  async getPerson(personId: number): Promise<any> {
    const data = await this.request(`/persons/${personId}`);
    return data;
  }

  /**
   * Buscar Deal por ID
   */
  async getDeal(dealId: number): Promise<any> {
    const data = await this.request(`/deals/${dealId}`);
    return data;
  }

  /**
   * Criar Person
   */
  async createPerson(data: {
    name: string;
    email?: string;
    phone?: string;
  }): Promise<any> {
    return this.circuitBreaker.execute(async () => {
      const response = await fetch(
        `${this.baseUrl}/persons?api_token=${this.apiToken}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: data.name,
            email: data.email ? [data.email] : undefined, // Pipedrive expects array
            phone: data.phone ? [{ value: data.phone, primary: true }] : undefined
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Pipedrive API error: ${response.status} - ${error}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(`Pipedrive createPerson failed: ${result.error}`);
      }

      return result.data;
    });
  }

  /**
   * Criar Deal
   */
  async createDeal(data: {
    title: string;
    person_id: number;
    value: number;
    currency?: string;
  }): Promise<any> {
    return this.request("/deals", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Atualizar Deal
   */
  async updateDeal(dealId: number, data: any): Promise<any> {
    return this.request(`/deals/${dealId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  /**
   * Marcar Deal como Won
   */
  async markDealAsWon(dealId: number): Promise<any> {
    return this.updateDeal(dealId, { status: "won" });
  }

  /**
   * Update Person in Pipedrive
   */
  async updatePerson(personId: number, data: {
    name?: string;
    email?: string;
    phone?: string;
  }): Promise<any> {
    return this.request(`/persons/${personId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  /**
   * Get all Persons (with pagination)
   */
  async getAllPersons(params?: {
    start?: number;
    limit?: number;
  }): Promise<{ data: any[]; hasMore: boolean }> {
    const start = params?.start || 0;
    const limit = params?.limit || 100;

    const response = await this.request(`/persons?start=${start}&limit=${limit}`);

    // Pipedrive returns an object with data array and additional_data
    return {
      data: Array.isArray(response) ? response : response.data || [],
      hasMore: response.additional_data?.pagination?.more_items_in_collection || false,
    };
  }

  /**
   * Get all Deals (with pagination)
   */
  async getAllDeals(params?: {
    start?: number;
    limit?: number;
    status?: 'all_not_deleted' | 'open' | 'won' | 'lost';
  }): Promise<{ data: any[]; hasMore: boolean }> {
    const start = params?.start || 0;
    const limit = params?.limit || 100;
    const status = params?.status || 'all_not_deleted';

    const response = await this.request(`/deals?start=${start}&limit=${limit}&status=${status}`);

    return {
      data: Array.isArray(response) ? response : response.data || [],
      hasMore: response.additional_data?.pagination?.more_items_in_collection || false,
    };
  }

  /**
   * Add note to Deal
   */
  async addNoteToDeal(dealId: number, content: string): Promise<any> {
    return this.request("/notes", {
      method: "POST",
      body: JSON.stringify({
        content,
        deal_id: dealId,
      }),
    });
  }

  /**
   * Add activity to Deal
   */
  async addActivityToDeal(dealId: number, data: {
    subject: string;
    type: string;
    note?: string;
    due_date?: string;
  }): Promise<any> {
    return this.request("/activities", {
      method: "POST",
      body: JSON.stringify({
        ...data,
        deal_id: dealId,
      }),
    });
  }
}

export const pipedriveService = new PipedriveService();

