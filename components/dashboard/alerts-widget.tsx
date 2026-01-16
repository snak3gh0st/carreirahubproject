"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useToast } from "@/lib/contexts/toast.context";
import { Bell, X, AlertCircle, CheckCircle, Clock } from "lucide-react";

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

export function AlertsWidget() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(false);
      const response = await fetch("/api/dashboard/alerts");
      if (!response.ok) throw new Error("Failed to fetch alerts");
      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error("Failed to fetch alerts:", err);
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
      }
    } catch (err) {
      console.error("Failed to acknowledge alert:", err);
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
      }
    } catch (err) {
      console.error("Failed to resolve alert:", err);
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
      }
    } catch (err) {
      console.error("Failed to dismiss alert:", err);
    }
  };

  const getSeverityColor = (severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") => {
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
        return "bg-gray-100 dark:bg-gray-800";
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

  return (
    <>
      {/* Bell Icon Widget - Fixed Position */}
      <div className="fixed bottom-8 right-8 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
          title={`${activeAlerts.length} active alerts`}
        >
          <Bell className="w-6 h-6" />
          {activeAlerts.length > 0 && (
            <span className="absolute top-0 right-0 inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-red-500 rounded-full">
              {activeAlerts.length > 9 ? "9+" : activeAlerts.length}
            </span>
          )}
        </button>
      </div>

      {/* Alerts Popup Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-8 w-96 max-h-[600px] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 flex flex-col">
          {/* Header */}
          <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Alerts
              </h3>
              {activeAlerts.length > 0 && (
                <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-red-500 rounded-full">
                  {activeAlerts.length}
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeAlerts.length === 0 ? (
              <div className="p-6 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  No Active Alerts
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Everything looks good!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {activeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 border-l-4 ${getSeverityColor(alert.severity)}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-1">
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${getSeverityBadgeColor(alert.severity)}`}
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {alert.title}
                          </h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                            {alert.description}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      {alert.status === "ACTIVE" && (
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                        >
                          Acknowledge
                        </button>
                      )}
                      {alert.status === "ACKNOWLEDGED" && (
                        <button
                          onClick={() => handleResolve(alert.id)}
                          className="text-xs px-2 py-1 rounded bg-green-200 dark:bg-green-900/30 text-green-700 dark:text-green-200 hover:bg-green-300 dark:hover:bg-green-800/50"
                        >
                          Resolve
                        </button>
                      )}
                      <button
                        onClick={() => handleDismiss(alert.id)}
                        className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-3 text-center">
            <button
              onClick={fetchAlerts}
              className="text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
