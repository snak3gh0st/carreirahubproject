/**
 * Clint CRM Service
 *
 * Responsabilidade: Integração com Clint API (https://api.clint.digital/v1)
 * Auth: header `api-token`
 * Padrão: pull-only (sem reverse sync na V1)
 */
import { CircuitBreaker, CircuitOpenError } from "@/lib/utils/circuit-breaker";
import { integrationLogger, StructuredErrorData } from "@/lib/utils/logger";

const CLINT_BASE_URL = "https://api.clint.digital/v1";
const PAGE_LIMIT = 100;
const REQUEST_TIMEOUT_MS = 20_000;

export type ClintContact = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  ddi?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type ClintDeal = {
  id: string;
  name?: string;
  title?: string;
  value?: number;
  status?: string;
  contact_id?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

type ClintPageResponse<T> = {
  data: T[];
  meta?: { total?: number; page?: number; per_page?: number };
};

export class ClintService {
  private apiKey: string;
  private circuitBreaker: CircuitBreaker;

  constructor() {
    this.apiKey = process.env.CLINT_API_KEY || "";
    this.circuitBreaker = new CircuitBreaker("clint");
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
    if (!this.apiKey) {
      throw new Error("CLINT_API_KEY not configured");
    }

    const startTime = Date.now();
    const url = `${CLINT_BASE_URL}${endpoint}`;

    try {
      return await this.circuitBreaker.execute(async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
          const response = await fetch(url, {
            ...options,
            headers: {
              "api-token": this.apiKey,
              "Content-Type": "application/json",
              ...options.headers,
            },
            signal: controller.signal,
          });

          if (!response.ok) {
            const error: any = new Error(`Clint API error: ${response.status} ${response.statusText}`);
            error.status = response.status;
            throw error;
          }

          return await response.json() as T;
        } finally {
          clearTimeout(timeout);
        }
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;

      if (error instanceof CircuitOpenError) {
        const structured: StructuredErrorData = {
          errorCode: "CIRCUIT_OPEN",
          category: "transient",
          severity: "error",
          recovery: "wait",
          metadata: { endpoint, method: options.method || "GET" },
        };
        await integrationLogger.logError("clint", endpoint, error, structured, { endpoint }, durationMs);
        return null;
      }

      const structured: StructuredErrorData = {
        errorCode: (error as any)?.code || `HTTP_${(error as any)?.status || 500}`,
        category: (error as any)?.status === 401 ? "auth" : "transient",
        metadata: { statusCode: (error as any)?.status, message: (error as any)?.message },
      };
      await integrationLogger.logError("clint", endpoint, error as Error, structured, { endpoint }, durationMs);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    const result = await this.request<ClintPageResponse<ClintContact>>("/contacts?limit=1");
    return result !== null;
  }

  async getContacts(limit = PAGE_LIMIT, offset = 0): Promise<ClintPageResponse<ClintContact>> {
    const result = await this.request<ClintPageResponse<ClintContact>>(
      `/contacts?limit=${limit}&offset=${offset}`
    );
    return result ?? { data: [] };
  }

  async getContact(id: string): Promise<ClintContact | null> {
    return this.request<ClintContact>(`/contacts/${id}`);
  }

  async getAllContacts(): Promise<ClintContact[]> {
    const all: ClintContact[] = [];
    let offset = 0;

    while (true) {
      const page = await this.getContacts(PAGE_LIMIT, offset);
      if (!page.data?.length) break;
      all.push(...page.data);
      if (page.data.length < PAGE_LIMIT) break;
      offset += PAGE_LIMIT;
    }

    return all;
  }

  async getDeals(limit = PAGE_LIMIT, offset = 0): Promise<ClintPageResponse<ClintDeal>> {
    const result = await this.request<ClintPageResponse<ClintDeal>>(
      `/deals?limit=${limit}&offset=${offset}`
    );
    return result ?? { data: [] };
  }

  async getDeal(id: string): Promise<ClintDeal | null> {
    return this.request<ClintDeal>(`/deals/${id}`);
  }

  async getAllDeals(): Promise<ClintDeal[]> {
    const all: ClintDeal[] = [];
    let offset = 0;

    while (true) {
      const page = await this.getDeals(PAGE_LIMIT, offset);
      if (!page.data?.length) break;
      all.push(...page.data);
      if (page.data.length < PAGE_LIMIT) break;
      offset += PAGE_LIMIT;
    }

    return all;
  }
}

export const clintService = new ClintService();
