import { prisma } from "@/lib/db";

export interface LogData {
  service: string;
  action: string;
  status: "SUCCESS" | "ERROR" | "PARTIAL";
  payload?: any;
  error?: string;
  retryCount?: number;
}

/**
 * Logger para IntegrationLog
 * 
 * Responsabilidade: Registrar todas as operações críticas do sistema
 */
export class IntegrationLogger {
  /**
   * Logar operação
   */
  async log(data: LogData): Promise<void> {
    try {
      await prisma.integrationLog.create({
        data: {
          service: data.service,
          action: data.action,
          status: data.status,
          payload: data.payload || {},
          error: data.error,
          retryCount: data.retryCount || 0,
        },
      });
    } catch (error) {
      // Não queremos que erros de log quebrem o sistema
      console.error("Error logging to IntegrationLog:", error);
    }
  }

  /**
   * Logar sucesso
   */
  async logSuccess(
    service: string,
    action: string,
    payload?: any
  ): Promise<void> {
    await this.log({
      service,
      action,
      status: "SUCCESS",
      payload,
    });
  }

  /**
   * Logar erro
   */
  async logError(
    service: string,
    action: string,
    error: string | Error,
    payload?: any,
    retryCount?: number
  ): Promise<void> {
    await this.log({
      service,
      action,
      status: "ERROR",
      error: error instanceof Error ? error.message : error,
      payload,
      retryCount,
    });
  }

  /**
   * Logar operação parcial (sucesso com ressalvas)
   */
  async logPartial(
    service: string,
    action: string,
    payload?: any
  ): Promise<void> {
    await this.log({
      service,
      action,
      status: "PARTIAL",
      payload,
    });
  }

  /**
   * Buscar logs por serviço
   */
  async getLogsByService(
    service: string,
    limit: number = 100
  ): Promise<any[]> {
    return prisma.integrationLog.findMany({
      where: { service },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Buscar logs por status
   */
  async getLogsByStatus(
    status: string,
    limit: number = 100
  ): Promise<any[]> {
    return prisma.integrationLog.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Buscar logs de erro recentes
   */
  async getRecentErrors(limit: number = 50): Promise<any[]> {
    return prisma.integrationLog.findMany({
      where: { status: "ERROR" },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}

export const integrationLogger = new IntegrationLogger();

