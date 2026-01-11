"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { StatusIndicator, StatusType } from "@/components/ui/status-indicator";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

interface SyncStatusData {
  pipedrive: {
    lastSync: string | null;
    successRate: number;
    successCount: number;
    errorCount: number;
    total: number;
    status: StatusType;
  };
  quickbooks: {
    lastSync: string | null;
    isAuthenticated: boolean;
    successRate: number;
    successCount: number;
    errorCount: number;
    total: number;
    status: StatusType;
  };
  bulkImports: {
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
  recentErrors: Array<{
    id: string;
    service: string;
    action: string;
    error: string;
    createdAt: string;
  }>;
  timeframe: string;
}

export default function SyncStatusPage() {
  const [syncStatus, setSyncStatus] = useState<SyncStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch("/api/integrations/sync-status");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch sync status");
      }

      setSyncStatus(data.syncStatus);
      setIsLoading(false);
      setError(null);
    } catch (err) {
      console.error("Error fetching sync status:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch sync status");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSyncStatus();

    if (autoRefresh) {
      const interval = setInterval(fetchSyncStatus, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <svg
              className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <p className="text-gray-600">Loading sync status...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !syncStatus) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Error</h2>
          <p className="text-red-700">{error || "Failed to load sync status"}</p>
          <Button variant="primary" onClick={fetchSyncStatus} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const overallHealthy =
    syncStatus.pipedrive.status === "healthy" &&
    syncStatus.quickbooks.status === "healthy";

  return (
    <div className="container mx-auto p-6">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link href="/dashboard/integrations" className="text-blue-600 hover:underline text-sm">
          ← Back to Integrations
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Integration Sync Status</h1>
          <p className="text-gray-600 mt-1">
            Monitor the health of QuickBooks and Pipedrive integrations • {syncStatus.timeframe}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (30s)
          </label>
          <Button variant="ghost" size="sm" onClick={fetchSyncStatus}>
            <svg
              className="w-4 h-4 mr-2"
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
            Refresh
          </Button>
          <Link href="/dashboard/integrations/bulk-import">
            <Button variant="primary">Start Bulk Import</Button>
          </Link>
        </div>
      </div>

      {/* Overall Health Status */}
      <div
        className={`rounded-lg p-6 mb-6 ${
          overallHealthy
            ? "bg-green-50 border border-green-200"
            : "bg-yellow-50 border border-yellow-200"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-1">
              {overallHealthy ? "✓ All Systems Operational" : "⚠️ Some Issues Detected"}
            </h2>
            <p
              className={`text-sm ${
                overallHealthy ? "text-green-700" : "text-yellow-700"
              }`}
            >
              {overallHealthy
                ? "All integrations are syncing successfully"
                : "Some integrations require attention"}
            </p>
          </div>
          <StatusIndicator
            status={overallHealthy ? "healthy" : "warning"}
            showDot={true}
          />
        </div>
      </div>

      {/* Integration Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Pipedrive Card */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Pipedrive</h3>
              <StatusIndicator status={syncStatus.pipedrive.status} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Success Rate</div>
                <div className="text-2xl font-bold text-gray-900">
                  {syncStatus.pipedrive.successRate}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Total Operations</div>
                <div className="text-2xl font-bold text-gray-900">
                  {syncStatus.pipedrive.total}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Successful</div>
                <div className="text-lg font-semibold text-green-600">
                  {syncStatus.pipedrive.successCount}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Errors</div>
                <div className="text-lg font-semibold text-red-600">
                  {syncStatus.pipedrive.errorCount}
                </div>
              </div>
            </div>

            {syncStatus.pipedrive.lastSync && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">Last Sync</div>
                <div className="text-sm font-medium text-gray-900">
                  {new Date(syncStatus.pipedrive.lastSync).toLocaleString()}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-gray-50">
            <Link
              href="/dashboard/settings/integrations?source=pipedrive"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Configure Pipedrive →
            </Link>
          </div>
        </div>

        {/* QuickBooks Card */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">QuickBooks</h3>
              <StatusIndicator status={syncStatus.quickbooks.status} />
            </div>

            {!syncStatus.quickbooks.isAuthenticated && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                ⚠️ QuickBooks is not authenticated. Please reconnect.
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Success Rate</div>
                <div className="text-2xl font-bold text-gray-900">
                  {syncStatus.quickbooks.successRate}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Total Operations</div>
                <div className="text-2xl font-bold text-gray-900">
                  {syncStatus.quickbooks.total}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Successful</div>
                <div className="text-lg font-semibold text-green-600">
                  {syncStatus.quickbooks.successCount}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Errors</div>
                <div className="text-lg font-semibold text-red-600">
                  {syncStatus.quickbooks.errorCount}
                </div>
              </div>
            </div>

            {syncStatus.quickbooks.lastSync && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">Last Sync</div>
                <div className="text-sm font-medium text-gray-900">
                  {new Date(syncStatus.quickbooks.lastSync).toLocaleString()}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-gray-50">
            <Link
              href="/dashboard/settings/integrations?source=quickbooks"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Configure QuickBooks →
            </Link>
          </div>
        </div>
      </div>

      {/* Bulk Import Status */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Bulk Imports</h3>
          <Link href="/dashboard/integrations/bulk-import">
            <Button variant="ghost" size="sm">
              Start New Import →
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded">
            <div className="text-sm text-blue-700">Running</div>
            <div className="text-3xl font-bold text-blue-900">
              {syncStatus.bulkImports.running}
            </div>
          </div>
          <div className="p-4 bg-green-50 border border-green-200 rounded">
            <div className="text-sm text-green-700">Completed</div>
            <div className="text-3xl font-bold text-green-900">
              {syncStatus.bulkImports.completed}
            </div>
          </div>
          <div className="p-4 bg-red-50 border border-red-200 rounded">
            <div className="text-sm text-red-700">Failed</div>
            <div className="text-3xl font-bold text-red-900">
              {syncStatus.bulkImports.failed}
            </div>
          </div>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded">
            <div className="text-sm text-gray-700">Cancelled</div>
            <div className="text-3xl font-bold text-gray-900">
              {syncStatus.bulkImports.cancelled}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Errors */}
      {syncStatus.recentErrors.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4">
            Recent Errors ({syncStatus.recentErrors.length})
          </h3>

          <div className="space-y-3">
            {syncStatus.recentErrors.map((error) => (
              <div
                key={error.id}
                className="p-4 bg-red-50 border border-red-200 rounded-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-red-900">
                        {error.service}
                      </span>
                      <span className="text-sm text-red-700">• {error.action}</span>
                    </div>
                    <div className="text-sm text-red-800">{error.error}</div>
                  </div>
                  <div className="text-xs text-red-600 whitespace-nowrap ml-4">
                    {new Date(error.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {syncStatus.recentErrors.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">✓</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No Recent Errors
          </h3>
          <p className="text-gray-600">
            All sync operations completed successfully in the last 24 hours
          </p>
        </div>
      )}
    </div>
  );
}
