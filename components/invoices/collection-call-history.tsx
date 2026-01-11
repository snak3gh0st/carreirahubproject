"use client";

import { useState, useEffect } from "react";
import {
  Phone,
  PhoneOff,
  PhoneMissed,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { CollectionCallStatus, CollectionCallOutcome } from "@prisma/client";

interface CollectionCall {
  id: string;
  status: CollectionCallStatus;
  outcome: CollectionCallOutcome | null;
  duration: number | null;
  transcript: string | null;
  paymentPromised: boolean;
  promisedDate: Date | null;
  notes: string | null;
  initiatedBy: string | null;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
}

interface CollectionCallHistoryProps {
  invoiceId: string;
}

export function CollectionCallHistory({ invoiceId }: CollectionCallHistoryProps) {
  const [calls, setCalls] = useState<CollectionCall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchCallHistory();
  }, [invoiceId]);

  const fetchCallHistory = async () => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/collection-call`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch call history");
      }

      setCalls(data.calls || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load call history");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: CollectionCallStatus) => {
    switch (status) {
      case "COMPLETED":
        return <Phone className="w-4 h-4 text-green-500" />;
      case "IN_PROGRESS":
        return <Phone className="w-4 h-4 text-blue-500 animate-pulse" />;
      case "NO_ANSWER":
        return <PhoneMissed className="w-4 h-4 text-yellow-500" />;
      case "BUSY":
        return <PhoneOff className="w-4 h-4 text-orange-500" />;
      case "FAILED":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "CANCELLED":
        return <XCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: CollectionCallStatus) => {
    const labels: Record<CollectionCallStatus, string> = {
      PENDING: "Pending",
      IN_PROGRESS: "In Progress",
      COMPLETED: "Completed",
      NO_ANSWER: "No Answer",
      BUSY: "Busy",
      FAILED: "Failed",
      CANCELLED: "Cancelled",
    };
    return labels[status] || status;
  };

  const getOutcomeLabel = (outcome: CollectionCallOutcome | null) => {
    if (!outcome) return null;
    const labels: Record<CollectionCallOutcome, string> = {
      PAYMENT_PROMISED: "Payment Promised",
      PAYMENT_MADE: "Payment Made",
      DISPUTE: "Dispute",
      CALLBACK_REQUESTED: "Callback Requested",
      NO_COMMITMENT: "No Commitment",
      WRONG_NUMBER: "Wrong Number",
    };
    return labels[outcome] || outcome;
  };

  const getOutcomeColor = (outcome: CollectionCallOutcome | null) => {
    switch (outcome) {
      case "PAYMENT_PROMISED":
      case "PAYMENT_MADE":
        return "text-green-600 bg-green-50";
      case "DISPUTE":
      case "WRONG_NUMBER":
        return "text-red-600 bg-red-50";
      case "CALLBACK_REQUESTED":
        return "text-blue-600 bg-blue-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 flex items-center gap-2 py-2">
        <AlertCircle className="w-4 h-4" />
        {error}
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-2">
        No collection calls yet
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-4">
      <h4 className="text-sm font-medium text-gray-700">Call History</h4>
      <div className="space-y-2">
        {calls.map((call) => (
          <div
            key={call.id}
            className="border rounded-lg overflow-hidden bg-gray-50"
          >
            {/* Call summary row */}
            <button
              onClick={() => setExpandedId(expandedId === call.id ? null : call.id)}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-100 transition"
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(call.status)}
                <div className="text-left">
                  <div className="text-sm font-medium">
                    {getStatusLabel(call.status)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(call.createdAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {call.outcome && (
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${getOutcomeColor(
                      call.outcome
                    )}`}
                  >
                    {getOutcomeLabel(call.outcome)}
                  </span>
                )}
                {call.paymentPromised && (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                )}
                <span className="text-xs text-gray-500">
                  {formatDuration(call.duration)}
                </span>
                {expandedId === call.id ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </button>

            {/* Expanded details */}
            {expandedId === call.id && (
              <div className="border-t p-3 bg-white space-y-3">
                {/* Payment promise info */}
                {call.paymentPromised && (
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      Payment promised
                      {call.promisedDate &&
                        ` for ${new Date(call.promisedDate).toLocaleDateString(
                          "pt-BR"
                        )}`}
                    </span>
                  </div>
                )}

                {/* Notes */}
                {call.notes && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      Notes
                    </div>
                    <p className="text-sm text-gray-700">{call.notes}</p>
                  </div>
                )}

                {/* Transcript */}
                {call.transcript && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      Transcript
                    </div>
                    <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded max-h-40 overflow-y-auto whitespace-pre-wrap">
                      {call.transcript}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>
                    Initiated by:{" "}
                    {call.initiatedBy === "SYSTEM" ? "Automatic" : "Manual"}
                  </span>
                  {call.duration && (
                    <span>Duration: {formatDuration(call.duration)}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
