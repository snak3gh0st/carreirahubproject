/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by implementing the circuit breaker pattern:
 * - CLOSED: Normal operation, calls go through
 * - OPEN: Too many failures, calls fail fast without hitting external API
 * - HALF_OPEN: Testing recovery, allow one call through
 *
 * State machine:
 * CLOSED -> OPEN (when failureCount >= thresholdFailures)
 * OPEN -> HALF_OPEN (after timeoutMs milliseconds)
 * HALF_OPEN -> CLOSED (if call succeeds)
 * HALF_OPEN -> OPEN (if call fails)
 */

import { prisma } from "@/lib/db";

export class CircuitOpenError extends Error {
  constructor(serviceName: string, lastErrorMessage?: string) {
    super(
      `Circuit breaker is OPEN for ${serviceName}. ${lastErrorMessage ? `Last error: ${lastErrorMessage}` : "Service temporarily unavailable."}`
    );
    this.name = "CircuitOpenError";
  }
}

export interface CircuitBreakerOptions {
  thresholdFailures?: number; // failures before opening (default: 5)
  thresholdSuccesses?: number; // successes before closing from HALF_OPEN (default: 2)
  timeoutMs?: number; // timeout before attempting recovery (default: 60000ms = 60s)
}

export interface CircuitState {
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  failureCount: number;
  successCount: number;
  lastStateChangeAt: Date;
  lastErrorMessage?: string;
  uptime?: number; // percentage over last 24h
}

export class CircuitBreaker {
  private serviceName: string;
  private thresholdFailures: number;
  private thresholdSuccesses: number;
  private timeoutMs: number;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastStateChangeAt: Date = new Date();
  private lastErrorMessage?: string;

  constructor(serviceName: string, options?: CircuitBreakerOptions) {
    this.serviceName = serviceName;
    this.thresholdFailures = options?.thresholdFailures ?? 5;
    this.thresholdSuccesses = options?.thresholdSuccesses ?? 2;
    this.timeoutMs = options?.timeoutMs ?? 60000;

    // Load state from database on instantiation
    this.loadStateFromDatabase().catch((err) => {
      console.error(`[CircuitBreaker] Failed to load state for ${serviceName}:`, err);
    });
  }

  /**
   * Load state from database on instantiation
   */
  private async loadStateFromDatabase(): Promise<void> {
    try {
      const dbState = await prisma.circuitBreakerState.findUnique({
        where: { serviceName: this.serviceName },
      });

      if (dbState) {
        this.state = dbState.state as "CLOSED" | "OPEN" | "HALF_OPEN";
        this.failureCount = dbState.failureCount;
        this.successCount = dbState.successCount;
        this.lastStateChangeAt = dbState.lastStateChangeAt;
        this.lastErrorMessage = dbState.lastErrorMessage || undefined;
        this.thresholdFailures = dbState.thresholdFailures;
        this.thresholdSuccesses = dbState.thresholdSuccesses;
        this.timeoutMs = dbState.timeoutMs;
      }
    } catch (error) {
      console.error(`[CircuitBreaker] Error loading state for ${this.serviceName}:`, error);
    }
  }

  /**
   * Main execution method - execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if should transition OPEN -> HALF_OPEN
    this.checkForRecovery();

    // If circuit is OPEN, fail fast
    if (this.state === "OPEN") {
      throw new CircuitOpenError(this.serviceName, this.lastErrorMessage);
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error);
      throw error;
    }
  }

  /**
   * Record successful execution
   */
  private async recordSuccess(): Promise<void> {
    this.successCount++;
    this.failureCount = 0; // Reset failure count on success

    // If in HALF_OPEN and threshold met, transition to CLOSED
    if (this.state === "HALF_OPEN" && this.successCount >= this.thresholdSuccesses) {
      await this.setState("CLOSED");
      this.successCount = 0;
    }

    // Persist to database
    await this.persistState();
  }

  /**
   * Record failed execution
   */
  private async recordFailure(error: any): Promise<void> {
    this.failureCount++;
    this.lastErrorMessage = error?.message || String(error);
    this.successCount = 0; // Reset success count on failure

    // If threshold exceeded, transition to OPEN
    if (this.state !== "OPEN" && this.failureCount >= this.thresholdFailures) {
      await this.setState("OPEN");
    }

    // Persist to database
    await this.persistState();
  }

  /**
   * Check if should transition OPEN -> HALF_OPEN due to timeout
   */
  private checkForRecovery(): void {
    if (this.state === "OPEN") {
      const timeSinceChange = Date.now() - this.lastStateChangeAt.getTime();
      if (timeSinceChange >= this.timeoutMs) {
        // Transition to HALF_OPEN to test recovery
        this.state = "HALF_OPEN";
        this.failureCount = 0;
        this.successCount = 0;
        this.lastStateChangeAt = new Date();
        // Don't persist here - will persist on next success/failure
      }
    }
  }

  /**
   * Transition to new state and persist
   */
  private async setState(newState: "CLOSED" | "OPEN" | "HALF_OPEN"): Promise<void> {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChangeAt = new Date();

    // Only reset counts when transitioning to CLOSED
    if (newState === "CLOSED") {
      this.failureCount = 0;
      this.successCount = 0;
    }

    console.log(
      `[CircuitBreaker] ${this.serviceName}: ${oldState} -> ${newState}${
        this.lastErrorMessage ? ` (${this.lastErrorMessage})` : ""
      }`
    );

    // Persist to database
    await this.persistState();
  }

  /**
   * Persist current state to database (atomic upsert)
   */
  private async persistState(): Promise<void> {
    try {
      await prisma.circuitBreakerState.upsert({
        where: { serviceName: this.serviceName },
        create: {
          serviceName: this.serviceName,
          state: this.state,
          failureCount: this.failureCount,
          successCount: this.successCount,
          lastStateChangeAt: this.lastStateChangeAt,
          lastErrorMessage: this.lastErrorMessage,
          thresholdFailures: this.thresholdFailures,
          thresholdSuccesses: this.thresholdSuccesses,
          timeoutMs: this.timeoutMs,
        },
        update: {
          state: this.state,
          failureCount: this.failureCount,
          successCount: this.successCount,
          lastStateChangeAt: this.lastStateChangeAt,
          lastErrorMessage: this.lastErrorMessage,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error(`[CircuitBreaker] Failed to persist state for ${this.serviceName}:`, error);
    }
  }

  /**
   * Get current circuit state (for monitoring)
   */
  getState(): CircuitState {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastStateChangeAt: this.lastStateChangeAt,
      lastErrorMessage: this.lastErrorMessage,
    };
  }

  /**
   * Get metrics for monitoring endpoint
   */
  async getMetrics(): Promise<CircuitState & { recoveryAt?: Date }> {
    const state = this.getState();

    // Calculate recovery time if OPEN
    let recoveryAt: Date | undefined;
    if (this.state === "OPEN") {
      recoveryAt = new Date(this.lastStateChangeAt.getTime() + this.timeoutMs);
    }

    return {
      ...state,
      recoveryAt,
    };
  }

  /**
   * Manual reset to CLOSED (for debugging/ops)
   */
  async reset(): Promise<void> {
    await this.setState("CLOSED");
    this.failureCount = 0;
    this.successCount = 0;
    this.lastErrorMessage = undefined;
    console.log(`[CircuitBreaker] ${this.serviceName} manually reset to CLOSED`);
  }
}

/**
 * Factory function to create or get singleton circuit breaker for a service
 * This prevents multiple instances from being created per request
 */
const circuitBreakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(
  serviceName: string,
  options?: CircuitBreakerOptions
): CircuitBreaker {
  if (!circuitBreakers.has(serviceName)) {
    circuitBreakers.set(serviceName, new CircuitBreaker(serviceName, options));
  }
  return circuitBreakers.get(serviceName)!;
}
