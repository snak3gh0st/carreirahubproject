import React from "react";
import { Badge, BadgeVariant } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface WebhookStatsCardProps {
  serviceName: string;
  status: "healthy" | "degraded" | "unhealthy";
  successRate: number;
  recentErrors: number;
  totalEvents: number;
}

const statusToBadgeVariant: Record<string, BadgeVariant> = {
  healthy: "success",
  degraded: "warning",
  unhealthy: "error",
};

const statusToColor: Record<string, string> = {
  healthy: "text-green-600",
  degraded: "text-yellow-600",
  unhealthy: "text-red-600",
};

/**
 * Webhook service statistics card component
 *
 * Displays health metrics for a single webhook service including
 * status, success rate, and recent error count.
 */
export function WebhookStatsCard({
  serviceName,
  status,
  successRate,
  recentErrors,
  totalEvents,
}: WebhookStatsCardProps) {
  const successRatePercent = (successRate * 100).toFixed(1);

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base capitalize">{serviceName}</CardTitle>
          <Badge variant={statusToBadgeVariant[status]}>
            {status.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <div className="text-sm text-gray-600 mb-1">Success Rate</div>
            <div className={`text-2xl font-bold ${statusToColor[status]}`}>
              {successRatePercent}%
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Total Events</div>
              <div className="font-semibold">{totalEvents}</div>
            </div>
            <div>
              <div className="text-gray-600">Recent Errors</div>
              <div className="font-semibold text-red-600">{recentErrors}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
