/**
 * Pipedrive Service
 *
 * Responsabilidade: Integração com Pipedrive API
 */
import { CircuitBreaker, CircuitOpenError } from "@/lib/utils/circuit-breaker";
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
          throw new Error(`Pipedrive API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.data || data;
      });
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        // Circuit is open - return null/fallback
        console.warn(`[Pipedrive] Circuit breaker open: ${error.message}`);
        // Log to integration log
        await prisma.integrationLog.create({
          data: {
            service: "pipedrive",
            action: endpoint,
            status: "CIRCUIT_OPEN",
            payload: { endpoint, method: options.method || "GET" },
            error: error.message,
          },
        }).catch(err => console.error("[Pipedrive] Failed to log circuit open:", err));
        return null;
      }
      throw error;
    }
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
    return this.request("/persons", {
      method: "POST",
      body: JSON.stringify(data),
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

