"use client";

import { ContractStatus } from "@prisma/client";

interface ContractStatusBadgeProps {
  status: ContractStatus;
}

const statusConfig: Record<
  ContractStatus,
  { color: string; bg: string; label: string }
> = {
  DRAFT: { color: "text-gray-800", bg: "bg-gray-100", label: "Draft" },
  SENT_FOR_SIGNATURE: {
    color: "text-blue-800",
    bg: "bg-blue-100",
    label: "Sent for Signature",
  },
  VIEWED: { color: "text-purple-800", bg: "bg-purple-100", label: "Viewed" },
  SIGNED: { color: "text-green-800", bg: "bg-green-100", label: "Signed" },
  DECLINED: { color: "text-red-800", bg: "bg-red-100", label: "Declined" },
  VOIDED: { color: "text-gray-800", bg: "bg-gray-100", label: "Voided" },
  EXPIRED: { color: "text-orange-800", bg: "bg-orange-100", label: "Expired" },
};

export function ContractStatusBadge({ status }: ContractStatusBadgeProps) {
  const config = statusConfig[status] || {
    color: "text-gray-800",
    bg: "bg-gray-100",
    label: status,
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}
    >
      {config.label}
    </span>
  );
}
