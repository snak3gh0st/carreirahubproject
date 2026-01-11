"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Download, Trash2, Mail, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils/cn"

export interface BulkActionsConfig<T> {
  entityType: "invoice" | "lead" | "customer" | "deal"
  selectedIds: string[]
  onBulkAction: (action: string, ids: string[]) => Promise<void>
  canExport?: boolean
  canDelete?: boolean
  canEmail?: boolean
  canApprove?: boolean
  customActions?: Array<{
    label: string
    icon?: React.ReactNode
    action: string
    requiresConfirm?: boolean
  }>
}

export function BulkActions({
  entityType,
  selectedIds,
  onBulkAction,
  canExport = true,
  canDelete = true,
  canEmail = true,
  canApprove = false,
  customActions = [],
}: BulkActionsConfig<any>) {
  const [loading, setLoading] = React.useState(false)

  const selectedCount = selectedIds.length

  if (selectedCount === 0) return null

  const handleAction = async (action: string) => {
    try {
      setLoading(true)
      await onBulkAction(action, selectedIds)
      toast.success(`Action completed for ${selectedCount} item(s)`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Action failed"
      )
    } finally {
      setLoading(false)
    }
  }

  const getEntityLabel = () => {
    switch (entityType) {
      case "invoice":
        return "invoice"
      case "lead":
        return "lead"
      case "customer":
        return "customer"
      case "deal":
        return "deal"
      default:
        return "item"
    }
  }

  const entityLabel = getEntityLabel()

  return (
    <div className="sticky bottom-0 left-0 right-0 flex items-center justify-between gap-4 bg-blue-50 border-t border-blue-200 p-4 shadow-lg">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={true}
          disabled
          className="h-5 w-5"
        />
        <span className="text-sm font-semibold text-gray-900">
          {selectedCount} {entityLabel}
          {selectedCount !== 1 ? "s" : ""} selected
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Standard Actions */}
        {canEmail && entityType === "invoice" && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleAction("send-payment-links")}
            disabled={loading}
            className="gap-2"
          >
            <Mail className="h-4 w-4" />
            Send Payment Links
          </Button>
        )}

        {canApprove && entityType === "invoice" && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleAction("approve")}
            disabled={loading}
            className="gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Approve
          </Button>
        )}

        {canEmail && entityType === "lead" && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleAction("send-message")}
            disabled={loading}
            className="gap-2"
          >
            <Mail className="h-4 w-4" />
            Send Message
          </Button>
        )}

        {/* Custom Actions */}
        {customActions.length > 0 && (
          <>
            {customActions.map((customAction) => (
              <Button
                key={customAction.action}
                size="sm"
                variant="secondary"
                onClick={() => handleAction(customAction.action)}
                disabled={loading}
                className="gap-2"
              >
                {customAction.icon}
                {customAction.label}
              </Button>
            ))}
          </>
        )}

        {/* More Actions Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="secondary"
              className="gap-2"
              disabled={loading}
            >
              <MoreHorizontal className="h-4 w-4" />
              More
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canExport && (
              <>
                <DropdownMenuItem onClick={() => handleAction("export-csv")}>
                  <Download className="mr-2 h-4 w-4" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            {canDelete && (
              <DropdownMenuItem
                onClick={() => {
                  if (
                    window.confirm(
                      `Are you sure you want to delete ${selectedCount} ${entityLabel}(s)? This action cannot be undone.`
                    )
                  ) {
                    handleAction("delete")
                  }
                }}
                className="text-red-600 focus:bg-red-50 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Selected
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

/**
 * Checkbox column for tables using TanStack React Table
 * Usage:
 *   columns.push({
 *     id: "select",
 *     header: SelectCheckbox,
 *     cell: SelectCheckbox,
 *   })
 */
export const SelectCheckbox = ({ table, row }: any) => {
  if (row) {
    return (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value: boolean) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    )
  }

  // Header checkbox for select all
  return (
    <Checkbox
      checked={table.getIsAllPageRowsSelected()}
      onCheckedChange={(value: boolean) => table.toggleAllPageRowsSelected(!!value)}
      aria-label="Select all rows"
      className="translate-y-[2px]"
    />
  )
}
