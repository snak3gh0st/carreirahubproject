"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useToast } from "@/lib/contexts/toast.context";

interface Alert {
  id: string;
  title: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";
  triggeredAt: string;
  acknowledgedAt?: string;
  customerId?: string;
  invoiceId?: string;
  dealId?: string;
  data?: Record<string, any>;
}

export function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/dashboard/alerts");
      if (!response.ok) throw new Error("Failed to fetch alerts");
      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      const response = await fetch(`/api/dashboard/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge" }),
      });
      if (response.ok) {
        setAlerts((prev) =>
          prev.map((a) =>
            a.id === alertId ? { ...a, status: "ACKNOWLEDGED" } : a
          )
        );
        addToast("Alert acknowledged", "success");
      } else {
        addToast("Failed to acknowledge alert", "error");
      }
    } catch (err) {
      console.error("Failed to acknowledge alert:", err);
      addToast("Error acknowledging alert", "error");
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      const response = await fetch(`/api/dashboard/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve" }),
      });
      if (response.ok) {
        setAlerts((prev) =>
          prev.map((a) =>
            a.id === alertId ? { ...a, status: "RESOLVED" } : a
          )
        );
        addToast("Alert resolved", "success");
      } else {
        addToast("Failed to resolve alert", "error");
      }
    } catch (err) {
      console.error("Failed to resolve alert:", err);
      addToast("Error resolving alert", "error");
    }
  };

  const handleDismiss = async (alertId: string) => {
    try {
      const response = await fetch(`/api/dashboard/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      });
      if (response.ok) {
        setAlerts((prev) =>
          prev.map((a) =>
            a.id === alertId ? { ...a, status: "DISMISSED" } : a
          )
        );
        addToast("Alert dismissed", "success");
      } else {
        addToast("Failed to dismiss alert", "error");
      }
    } catch (err) {
      console.error("Failed to dismiss alert:", err);
      addToast("Error dismissing alert", "error");
    }
  };

  const getSeverityColor = (
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  ) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200";
      case "HIGH":
        return "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-800 dark:text-orange-200";
      case "MEDIUM":
        return "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200";
      case "LOW":
        return "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200";
      default:
        return "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600";
    }
  };

  const getSeverityBadgeColor = (severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-500";
      case "HIGH":
        return "bg-orange-500";
      case "MEDIUM":
        return "bg-yellow-500";
      case "LOW":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const activeAlerts = alerts.filter(
    (a) => a.status === "ACTIVE" || a.status === "ACKNOWLEDGED"
  );

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (activeAlerts.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              No Active Alerts
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Everything looks good! All systems operating normally.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow mb-6 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            Active Alerts
            <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-red-500 rounded-full">
              {activeAlerts.length}
            </span>
          </h2>
          <button
            onClick={fetchAlerts}
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            title="Refresh alerts"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Alerts List */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {activeAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-6 border-l-4 ${getSeverityColor(alert.severity)}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`inline-block w-3 h-3 rounded-full ${getSeverityBadgeColor(alert.severity)}`}
                  />
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {alert.title}
                  </h3>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {alert.severity}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                  {alert.description}
                </p>
                <div className="text-xs text-gray-600 dark:text-gray-400 flex gap-4">
                  <span>
                    Triggered: {format(new Date(alert.triggeredAt), "MMM d, h:mm a")}
                  </span>
                  {alert.status === "ACKNOWLEDGED" && alert.acknowledgedAt && (
                    <span>
                      Acknowledged:{" "}
                      {format(new Date(alert.acknowledgedAt), "MMM d, h:mm a")}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 flex-shrink-0">
                {alert.status === "ACTIVE" && (
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    className="px-3 py-1 text-xs font-medium rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Acknowledge
                  </button>
                )}
                {alert.status === "ACKNOWLEDGED" && (
                  <button
                    onClick={() => handleResolve(alert.id)}
                    className="px-3 py-1 text-xs font-medium rounded bg-green-200 dark:bg-green-900/30 text-green-800 dark:text-green-200 hover:bg-green-300 dark:hover:bg-green-900/50 transition-colors"
                  >
                    Resolve
                  </button>
                )}
                <button
                  onClick={() => handleDismiss(alert.id)}
                  className="px-3 py-1 text-xs font-medium rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
