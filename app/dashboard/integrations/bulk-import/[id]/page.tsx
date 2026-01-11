"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = 'force-dynamic';

interface BulkImport {
  id: string;
  source: string;
  type: string;
  status: "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  totalRecords: number;
  processedRecords: number;
  successCount: number;
  errorCount: number;
  errors: any;
  progressPercentage: number;
  startedAt: string;
  completedAt: string | null;
  initiator: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export default function ImportProgressPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [importData, setImportData] = useState<BulkImport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchImportStatus = async () => {
    try {
      const response = await fetch(`/api/integrations/bulk-import/${params.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch import status");
      }

      setImportData(data.import);
      setIsLoading(false);
    } catch (err) {
      console.error("Error fetching import status:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch import status");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchImportStatus();

    // Poll every 2 seconds if import is running
    const interval = setInterval(() => {
      if (importData?.status === "RUNNING") {
        fetchImportStatus();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [params.id, importData?.status]);

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this import?")) {
      return;
    }

    setIsCancelling(true);

    try {
      const response = await fetch(`/api/integrations/bulk-import/${params.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel import");
      }

      alert("Import cancelled successfully");
      fetchImportStatus();
    } catch (err) {
      console.error("Error cancelling import:", err);
      alert(err instanceof Error ? err.message : "Failed to cancel import");
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
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
            <p className="text-gray-600">Loading import status...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !importData) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Error</h2>
          <p className="text-red-700">{error || "Import not found"}</p>
          <Button
            variant="primary"
            onClick={() => router.push("/dashboard/integrations/bulk-import")}
            className="mt-4"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const statusVariant =
    importData.status === "COMPLETED"
      ? "success"
      : importData.status === "FAILED"
      ? "error"
      : importData.status === "CANCELLED"
      ? "default"
      : "info";

  const progressVariant =
    importData.status === "COMPLETED"
      ? "success"
      : importData.status === "FAILED"
      ? "error"
      : "default";

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">Bulk Import Progress</h1>
          <Badge variant={statusVariant}>{importData.status}</Badge>
        </div>
        <p className="text-gray-600">
          {importData.source} • {importData.type.replace(/_AND_/g, " + ")}
        </p>
      </div>

      {/* Progress Overview */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <ProgressBar
          progress={importData.progressPercentage}
          label="Import Progress"
          variant={progressVariant}
          size="lg"
        />

        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">
              {importData.totalRecords}
            </div>
            <div className="text-sm text-gray-600 mt-1">Total Records</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {importData.successCount}
            </div>
            <div className="text-sm text-gray-600 mt-1">Successful</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600">
              {importData.errorCount}
            </div>
            <div className="text-sm text-gray-600 mt-1">Errors</div>
          </div>
        </div>

        {importData.status === "RUNNING" && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
              <svg
                className="animate-spin h-5 w-5 text-blue-600 mr-3"
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
              <span className="text-blue-900 font-medium">
                Import in progress... {importData.processedRecords} / {importData.totalRecords}{" "}
                records processed
              </span>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={handleCancel}
              isLoading={isCancelling}
            >
              Cancel Import
            </Button>
          </div>
        )}

        {importData.status === "COMPLETED" && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <span className="text-2xl mr-3">✓</span>
              <div>
                <div className="text-green-900 font-semibold">Import Completed Successfully</div>
                <div className="text-sm text-green-700">
                  Completed at {new Date(importData.completedAt!).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}

        {importData.status === "FAILED" && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <span className="text-2xl mr-3">✗</span>
              <div>
                <div className="text-red-900 font-semibold">Import Failed</div>
                <div className="text-sm text-red-700">
                  The import encountered critical errors and was stopped.
                </div>
              </div>
            </div>
          </div>
        )}

        {importData.status === "CANCELLED" && (
          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center">
              <span className="text-2xl mr-3">⊘</span>
              <div>
                <div className="text-gray-900 font-semibold">Import Cancelled</div>
                <div className="text-sm text-gray-700">
                  The import was cancelled at {new Date(importData.completedAt!).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Import Details */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Import Details</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Import ID:</span>
            <span className="font-mono text-gray-900">{importData.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Source:</span>
            <span className="font-medium text-gray-900">{importData.source}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Type:</span>
            <span className="font-medium text-gray-900">
              {importData.type.replace(/_AND_/g, " + ")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Started At:</span>
            <span className="text-gray-900">
              {new Date(importData.startedAt).toLocaleString()}
            </span>
          </div>
          {importData.completedAt && (
            <div className="flex justify-between">
              <span className="text-gray-600">Completed At:</span>
              <span className="text-gray-900">
                {new Date(importData.completedAt).toLocaleString()}
              </span>
            </div>
          )}
          {importData.initiator && (
            <div className="flex justify-between">
              <span className="text-gray-600">Initiated By:</span>
              <span className="text-gray-900">{importData.initiator.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Errors */}
      {importData.errorCount > 0 && importData.errors && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-red-900">
            Errors ({importData.errorCount})
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {Array.isArray(importData.errors) ? (
              importData.errors.map((error: any, index: number) => (
                <div
                  key={index}
                  className="p-3 bg-red-50 border border-red-200 rounded text-sm"
                >
                  <div className="font-medium text-red-900">
                    Record {error.recordId || index + 1}
                  </div>
                  <div className="text-red-700">{error.message || JSON.stringify(error)}</div>
                </div>
              ))
            ) : (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {JSON.stringify(importData.errors)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard/integrations/sync-status")}
        >
          View Sync Status
        </Button>

        {importData.status !== "RUNNING" && (
          <Button
            variant="primary"
            onClick={() => router.push("/dashboard/integrations/bulk-import")}
          >
            Start New Import
          </Button>
        )}
      </div>
    </div>
  );
}
