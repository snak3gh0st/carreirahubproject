"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge, BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WebhookStatsCard } from "@/components/webhook-stats-card";

interface ServiceHealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  successRate: number;
  recentErrors: number;
  totalEvents: number;
}

interface HealthCheckResponse {
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

interface DeadLetterEvent {
  id: string;
  service: string;
  event_type: string;
  event_id: string;
  last_error: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

interface DeadLetterResponse {
  events: DeadLetterEvent[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

const statusToBadgeVariant: Record<string, BadgeVariant> = {
  healthy: "success",
  degraded: "warning",
  unhealthy: "error",
};

/**
 * Webhook Monitoring Dashboard
 *
 * Displays real-time webhook health metrics including:
 * - Overall system status
 * - Per-service success rates
 * - Dead letter queue events
 * - Pending retry counts
 *
 * Protected by NextAuth middleware (requires authentication)
 */
export default function WebhookMonitoringPage() {
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(
    null
  );
  const [deadLetterEvents, setDeadLetterEvents] =
    useState<DeadLetterResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch health data and dead letter events in parallel
      const [healthRes, deadLetterRes] = await Promise.all([
        fetch("/api/webhooks/health"),
        fetch("/api/webhooks/dead-letter?limit=10"),
      ]);

      if (!healthRes.ok) {
        throw new Error("Failed to fetch health data");
      }

      const health: HealthCheckResponse = await healthRes.json();
      setHealthData(health);

      // Dead letter endpoint requires auth, might return 401/403
      if (deadLetterRes.ok) {
        const deadLetter: DeadLetterResponse = await deadLetterRes.json();
        setDeadLetterEvents(deadLetter);
      } else if (deadLetterRes.status === 401 || deadLetterRes.status === 403) {
        // User doesn't have permission, show empty state
        setDeadLetterEvents({ events: [], total: 0, limit: 10, offset: 0, hasMore: false });
      } else {
        throw new Error("Failed to fetch dead letter events");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while fetching data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-gray-600">Loading webhook monitoring data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-800 font-semibold mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
          <Button
            variant="danger"
            size="sm"
            onClick={fetchData}
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!healthData) {
    return null;
  }

  const serviceEntries = Object.entries(healthData.services).map(
    ([name, data]) => ({
      serviceName: name,
      ...data,
    })
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Webhook Monitoring
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Real-time webhook delivery and health metrics
          </p>
        </div>
        <Button variant="secondary" onClick={fetchData}>
          Refresh
        </Button>
      </div>

      {/* Overall System Status */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-gray-600 mb-2">Overall Health</div>
              <Badge
                variant={statusToBadgeVariant[healthData.status]}
                className="text-lg px-4 py-2"
              >
                {healthData.status.toUpperCase()}
              </Badge>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-2">Dead Letter Queue</div>
              <div className="text-2xl font-bold text-gray-900">
                {healthData.deadLetterCount}
              </div>
              <div className="text-sm text-gray-500">permanently failed</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-2">Pending Retries</div>
              <div className="text-2xl font-bold text-gray-900">
                {healthData.pendingRetries}
              </div>
              <div className="text-sm text-gray-500">awaiting retry</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-2">Last Updated</div>
              <div className="text-sm font-medium text-gray-900">
                {new Date(healthData.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Service Health Cards */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          Service Health (Last 24 Hours)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {serviceEntries.map((service) => (
            <WebhookStatsCard key={service.serviceName} {...service} />
          ))}
        </div>
      </div>

      {/* Recent Dead Letter Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Failed Events (Dead Letter Queue)</CardTitle>
        </CardHeader>
        <CardContent>
          {deadLetterEvents && deadLetterEvents.events.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Service
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Retries
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Error
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {deadLetterEvents.events.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {event.service}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-gray-600">
                          {event.event_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-gray-600 font-mono">
                          {event.event_id.substring(0, 16)}...
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {event.retry_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate">
                        <span className="text-sm text-red-600" title={event.last_error}>
                          {event.last_error}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-gray-600">
                          {new Date(event.created_at).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {deadLetterEvents.hasMore && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-600">
                    Showing {deadLetterEvents.events.length} of {deadLetterEvents.total} total events
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No dead letter events found. All webhooks processing successfully!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
