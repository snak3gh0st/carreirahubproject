import React from "react";
import { Badge, BadgeVariant } from "@/components/ui/badge";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

interface ApprovalStatusBadgeProps {
  status: ApprovalStatus;
  className?: string;
}

const statusConfig: Record<
  ApprovalStatus,
  { variant: BadgeVariant; label: string; icon: string }
> = {
  PENDING: {
    variant: "pending",
    label: "Pending Approval",
    icon: "⏳",
  },
  APPROVED: {
    variant: "success",
    label: "Approved",
    icon: "✓",
  },
  REJECTED: {
    variant: "error",
    label: "Rejected",
    icon: "✗",
  },
};

export function ApprovalStatusBadge({
  status,
  className = "",
}: ApprovalStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={className}>
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </Badge>
  );
}
