import { prisma } from "@/lib/db";

export interface LogData {
  service: string;
  action: string;
  status: "SUCCESS" | "ERROR" | "PARTIAL";
  payload?: any;
  error?: string;
  retryCount?: number;
}

export interface StructuredErrorData {
  errorCode?: string;
  category?: "transient" | "permanent" | "auth" | "validation" | "unknown";
  severity?: "info" | "warning" | "error" | "critical";
  recovery?: string;
  metadata?: any;
  durationMs?: number;
  [key: string]: any; // Allow additional properties for context
}

/**
 * Logger para IntegrationLog
 *
 * Responsabilidade: Registrar todas as operações críticas do sistema
 * com contexto estruturado para debugging e observabilidade
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
   * Logar erro com contexto estruturado
   */
  async logError(
    service: string,
    action: string,
    error: string | Error,
    structuredError?: StructuredErrorData,
    payload?: any,
    retryCount?: number
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : error;

    // If no structured error provided, auto-detect from error object
    const structured = structuredError || this.detectError(error);

    try {
      await prisma.integrationLog.create({
        data: {
          service,
          action,
          status: "ERROR",
          error: errorMessage,
          payload: payload || {},
          retryCount: retryCount || 0,
          errorCode: structured.errorCode,
          errorCategory: structured.category,
          errorSeverity: structured.severity,
          recoveryAction: structured.recovery,
          metadata: structured.metadata,
          durationMs: structured.durationMs,
        },
      });
    } catch (logError) {
      // Não queremos que erros de log quebrem o sistema
      console.error("Error logging to IntegrationLog:", logError);
    }
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
   * Extract error code from error object
   * Provider-specific error code extraction
   */
  private extractErrorCode(error: any): string {
    // Check common error properties
    if (error?.code) return error.code;
    if (error?.status) return `HTTP_${error.status}`;
    if (error?.statusCode) return `HTTP_${error.statusCode}`;

    // Check for provider-specific error structures
    if (error?.response?.status) return `HTTP_${error.response.status}`;
    if (error?.response?.data?.fault?.[0]?.detail) return error.response.data.fault[0].detail;

    // Check message patterns
    if (error?.message?.includes("timeout")) return "EXTERNAL_TIMEOUT";
    if (error?.message?.includes("ECONNREFUSED")) return "ECONNREFUSED";
    if (error?.message?.includes("rate limit")) return "RATE_LIMITED";
    if (error?.message?.includes("unauthorized")) return "AUTH_FAILED";

    return "UNKNOWN_ERROR";
  }

  /**
   * Categorize error for operator visibility
   */
  private categorizeError(error: any): "transient" | "permanent" | "auth" | "validation" | "unknown" {
    const errorCode = this.extractErrorCode(error);
    const status = error?.status || error?.statusCode || error?.response?.status;
    const message = error?.message || "";

    // Transient errors - will retry automatically
    if (
      errorCode === "EXTERNAL_TIMEOUT" ||
      errorCode === "ECONNREFUSED" ||
      status === 429 || // Rate limit
      status === 503 || // Service unavailable
      message.includes("timeout") ||
      message.includes("temporarily unavailable")
    ) {
      return "transient";
    }

    // Auth errors - token/credential issues
    if (
      status === 401 ||
      errorCode === "AUTH_FAILED" ||
      message.includes("unauthorized") ||
      message.includes("authentication") ||
      message.includes("token") ||
      message.includes("invalid credentials")
    ) {
      return "auth";
    }

    // Validation errors - bad request from client
    if (
      status === 400 ||
      errorCode === "INVALID_REQUEST" ||
      message.includes("required field") ||
      message.includes("invalid")
    ) {
      return "validation";
    }

    // Permanent errors - won't resolve without intervention
    if (
      status === 403 || // Forbidden
      status === 404 || // Not found
      status === 410 || // Gone
      errorCode === "RATE_LIMITED"
    ) {
      return "permanent";
    }

    // Default to unknown
    return "unknown";
  }

  /**
   * Calculate severity based on error category and status
   */
  private calculateSeverity(
    category: "transient" | "permanent" | "auth" | "validation" | "unknown",
    error: any
  ): "info" | "warning" | "error" | "critical" {
    if (category === "auth") return "critical"; // Auth failures prevent all operations
    if (category === "permanent") return "critical"; // Permanent failures need operator intervention
    if (category === "transient") return "error"; // Transient errors will retry but important
    if (category === "validation") return "warning"; // Client errors are less critical
    return "error"; // Unknown defaults to error
  }

  /**
   * Determine recovery action based on error category
   */
  private createRecoveryAction(
    category: "transient" | "permanent" | "auth" | "validation" | "unknown",
    _service: string
  ): string {
    switch (category) {
      case "transient":
        return "retry"; // Circuit breaker will handle
      case "permanent":
        return "manual_intervention"; // Operator needs to investigate
      case "auth":
        return "check_circuit"; // Re-authenticate service
      case "validation":
        return "contact_support"; // Client error, need to check request
      case "unknown":
      default:
        return "contact_support";
    }
  }

  /**
   * Auto-detect error details from error object
   */
  private detectError(error: any): StructuredErrorData {
    const errorCode = this.extractErrorCode(error);
    const category = this.categorizeError(error);
    const severity = this.calculateSeverity(category, error);
    const recovery = this.createRecoveryAction(category, "");

    return {
      errorCode,
      category,
      severity,
      recovery,
      metadata: {
        statusCode: error?.status || error?.statusCode || error?.response?.status,
        message: error?.message,
        retryable: category === "transient",
      },
    };
  }

  /**
   * Filter sensitive data from metadata
   */
  private filterSensitiveData(data: any): any {
    if (!data) return data;

    const sanitized = { ...data };
    const sensitiveKeys = ["token", "apiKey", "secret", "password", "auth", "bearer"];

    Object.keys(sanitized).forEach((key) => {
      if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = "[REDACTED]";
      }
    });

    return sanitized;
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
   * Buscar logs por categoria de erro
   */
  async getLogsByErrorCategory(
    category: string,
    limit: number = 100
  ): Promise<any[]> {
    return prisma.integrationLog.findMany({
      where: { errorCategory: category },
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

  /**
   * Get critical errors that need immediate attention
   */
  async getCriticalErrors(limit: number = 50): Promise<any[]> {
    return prisma.integrationLog.findMany({
      where: { errorSeverity: "critical", status: "ERROR" },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}

export const integrationLogger = new IntegrationLogger();

