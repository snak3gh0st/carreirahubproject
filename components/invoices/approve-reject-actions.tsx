"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface ApproveRejectActionsProps {
  invoiceId: string;
  invoiceNumber: string;
  onSuccess?: () => void;
}

export function ApproveRejectActions({
  invoiceId,
  invoiceNumber,
  onSuccess,
}: ApproveRejectActionsProps) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    if (!confirm(`Are you sure you want to approve invoice ${invoiceNumber}?`)) {
      return;
    }

    setIsApproving(true);
    setError(null);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to approve invoice");
      }

      alert("Invoice approved successfully! It will be synced to QuickBooks and Clint.");

      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error("Error approving invoice:", err);
      setError(err instanceof Error ? err.message : "Failed to approve invoice");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }

    setIsRejecting(true);
    setError(null);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: rejectionReason }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reject invoice");
      }

      alert("Invoice rejected. The submitter will be notified.");
      setShowRejectDialog(false);
      setRejectionReason("");

      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error("Error rejecting invoice:", err);
      setError(err instanceof Error ? err.message : "Failed to reject invoice");
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          variant="success"
          onClick={handleApprove}
          isLoading={isApproving}
          disabled={isRejecting}
          leftIcon={
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          }
        >
          Approve Invoice
        </Button>

        <Button
          variant="danger"
          onClick={() => setShowRejectDialog(true)}
          disabled={isApproving || isRejecting}
          leftIcon={
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          }
        >
          Reject Invoice
        </Button>
      </div>

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Reject Invoice {invoiceNumber}</h3>

            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for rejecting this invoice. The submitter will be notified.
            </p>

            <textarea
              className="w-full border border-gray-300 rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              rows={4}
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              disabled={isRejecting}
            />

            <div className="flex items-center justify-end gap-3 mt-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectionReason("");
                  setError(null);
                }}
                disabled={isRejecting}
              >
                Cancel
              </Button>

              <Button
                variant="danger"
                onClick={handleReject}
                isLoading={isRejecting}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
