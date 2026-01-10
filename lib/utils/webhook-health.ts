import { prisma } from "@/lib/db";

/**
 * Webhook Health Utilities
 *
 * Calculates webhook system health metrics from WebhookEvent table
 * for monitoring and alerting purposes.
 */

export interface ServiceHealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  successRate: number;
  recentErrors: number;
  totalEvents: number;
}

export interface HealthCheckResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  services: {
    pipedrive: ServiceHealthStatus;
    quickbooks: ServiceHealthStatus;
    stripe: ServiceHealthStatus;
    docusign: ServiceHealthStatus;
    twilio: ServiceHealthStatus;
    retell: ServiceHealthStatus;
  };
  deadLetterCount: number;
  pendingRetries: number;
}

/**
 * Calculate overall system health status based on service health
 */
function calculateOverallStatus(
  services: Record<string, ServiceHealthStatus>
): "healthy" | "degraded" | "unhealthy" {
  const statuses = Object.values(services).map((s) => s.status);

  // If any service is unhealthy, system is unhealthy
  if (statuses.includes("unhealthy")) {
    return "unhealthy";
  }

  // If any service is degraded, system is degraded
  if (statuses.includes("degraded")) {
    return "degraded";
  }

  // All services healthy
  return "healthy";
}

/**
 * Calculate health status for a single service
 */
function calculateServiceStatus(
  successRate: number
): "healthy" | "degraded" | "unhealthy" {
  if (successRate >= 0.95) {
    return "healthy";
  } else if (successRate >= 0.8) {
    return "degraded";
  } else {
    return "unhealthy";
  }
}

/**
 * Calculate webhook health metrics for all services
 *
 * Analyzes last 24 hours of webhook events to determine:
 * - Per-service success rates
 * - Recent error counts
 * - Dead letter queue size
 * - Pending retry count
 */
export async function calculateWebhookHealth(): Promise<HealthCheckResponse> {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Define all services we monitor
  const services = [
    "pipedrive",
    "quickbooks",
    "stripe",
    "docusign",
    "twilio",
    "retell",
  ];

  // Query webhook events from last 24 hours grouped by service and status
  const recentEvents = await prisma.webhookEvent.groupBy({
    by: ["service", "status"],
    where: {
      created_at: {
        gte: twentyFourHoursAgo,
      },
    },
    _count: {
      id: true,
    },
  });

  // Count dead letter queue (all time)
  const deadLetterCount = await prisma.webhookEvent.count({
    where: {
      status: "dead_letter",
    },
  });

  // Count pending retries (failed events with next_retry_at in the past)
  const pendingRetries = await prisma.webhookEvent.count({
    where: {
      status: "failed",
      next_retry_at: {
        lte: now,
      },
    },
  });

  // Initialize service health status
  const serviceHealth: Record<string, ServiceHealthStatus> = {};

  for (const service of services) {
    // Get event counts for this service
    const serviceEvents = recentEvents.filter((e) => e.service === service);

    const successCount =
      serviceEvents.find((e) => e.status === "success")?._count.id || 0;
    const failedCount =
      serviceEvents.find((e) => e.status === "failed")?._count.id || 0;
    const deadLetterCountForService =
      serviceEvents.find((e) => e.status === "dead_letter")?._count.id || 0;
    const pendingCount =
      serviceEvents.find((e) => e.status === "pending")?._count.id || 0;
    const processingCount =
      serviceEvents.find((e) => e.status === "processing")?._count.id || 0;

    const totalEvents =
      successCount +
      failedCount +
      deadLetterCountForService +
      pendingCount +
      processingCount;

    // Calculate success rate (if no events, assume healthy with 100% rate)
    const successRate = totalEvents > 0 ? successCount / totalEvents : 1.0;

    // Recent errors = failed + dead_letter from last 24h
    const recentErrors = failedCount + deadLetterCountForService;

    serviceHealth[service] = {
      status: calculateServiceStatus(successRate),
      successRate: parseFloat(successRate.toFixed(4)),
      recentErrors,
      totalEvents,
    };
  }

  return {
    status: calculateOverallStatus(serviceHealth),
    timestamp: now.toISOString(),
    services: {
      pipedrive: serviceHealth.pipedrive,
      quickbooks: serviceHealth.quickbooks,
      stripe: serviceHealth.stripe,
      docusign: serviceHealth.docusign,
      twilio: serviceHealth.twilio,
      retell: serviceHealth.retell,
    },
    deadLetterCount,
    pendingRetries,
  };
}
