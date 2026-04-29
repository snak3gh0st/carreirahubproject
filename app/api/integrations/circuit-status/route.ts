import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { CircuitBreaker } from "@/lib/utils/circuit-breaker";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/integrations/circuit-status
 *
 * Returns the status of all circuit breakers for external integrations.
 * Protected by NextAuth (ADMIN role required).
 *
 * Response:
 * {
 *   "timestamp": "2026-01-11T12:00:00Z",
 *   "overallHealth": "healthy" | "degraded" | "unhealthy",
 *   "circuits": {
 *     "pipedrive": { "state": "CLOSED", "failureCount": 0, "uptime": 0.99 },
 *     "quickbooks": { "state": "OPEN", "failureCount": 7, "uptime": 0.85, "recoveryAt": "2026-01-11T12:05:00Z" },
 *     ...
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized - session required" },
        { status: 401 }
      );
    }

    // Check role (ADMIN only)
    const userRole = (session.user as any)?.role;
    if (!userRole || userRole !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden - insufficient permissions" },
        { status: 403 }
      );
    }

    // Get all circuit breaker states from database
    const circuitStates = await prisma.circuitBreakerState.findMany();

    // Define all expected services
    const allServices = ["pipedrive", "quickbooks", "docusign", "whatsapp", "retell", "openai", "email"];

    // Build response
    const circuits: Record<string, any> = {};
    let openCount = 0;

    for (const service of allServices) {
      const state = circuitStates.find((s) => s.serviceName === service);

      if (state) {
        const isOpen = state.state === "OPEN";
        if (isOpen) openCount++;

        // Calculate uptime percentage over last 24h
        const total = state.successCount + state.failureCount;
        const uptime = total > 0 ? (state.successCount / total) : 1.0;

        // Calculate recovery time if OPEN
        let recoveryAt: string | undefined;
        if (isOpen) {
          const recoveryTime = new Date(state.lastStateChangeAt.getTime() + state.timeoutMs);
          recoveryAt = recoveryTime.toISOString();
        }

        circuits[service] = {
          state: state.state,
          failureCount: state.failureCount,
          successCount: state.successCount,
          uptime: parseFloat(uptime.toFixed(4)),
          lastStateChangeAt: state.lastStateChangeAt.toISOString(),
          lastErrorMessage: state.lastErrorMessage || null,
          recoveryAt,
        };
      } else {
        // Service not in database yet - assume healthy
        circuits[service] = {
          state: "CLOSED",
          failureCount: 0,
          successCount: 0,
          uptime: 1.0,
          lastStateChangeAt: new Date().toISOString(),
          lastErrorMessage: null,
        };
      }
    }

    // Determine overall health
    let overallHealth = "healthy";
    if (openCount > 0) {
      const openPercentage = (openCount / allServices.length) * 100;
      if (openPercentage > 50) {
        overallHealth = "unhealthy";
      } else {
        overallHealth = "degraded";
      }
    }

    const response = {
      timestamp: new Date().toISOString(),
      overallHealth,
      circuits,
    };

    // Return 503 if >50% circuits are open (operator alert)
    const statusCode = overallHealth === "unhealthy" ? 503 : 200;

    return NextResponse.json(response, { status: statusCode });
  } catch (error) {
    console.error("[CircuitStatus] Error fetching circuit breaker status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
