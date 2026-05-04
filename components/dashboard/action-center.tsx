"use client";

import Link from "next/link";
import type { ElementType } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  FileSignature,
  Link2Off,
  Loader2,
  Target,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface DashboardActionCounts {
  openInvoiceCount: number;
  partialInvoiceCount: number;
  pendingContractCount: number;
  openDealCount: number;
  qualifiedLeadCount: number;
  quickbooksGapCount: number;
  autoChargeRiskCount: number;
}

interface DashboardActionCenterProps {
  role: string;
  actions: DashboardActionCounts;
  isLoading?: boolean;
}

const numberFmt = new Intl.NumberFormat("en-US");
type ActionTone = "neutral" | "warning" | "danger" | "success";

interface ActionRowProps {
  href: string;
  icon: ElementType;
  title: string;
  detail: string;
  count: number;
  tone?: ActionTone;
  isLoading?: boolean;
}

function ActionRow({
  href,
  icon: Icon,
  title,
  detail,
  count,
  tone = "neutral",
  isLoading = false,
}: ActionRowProps) {
  const toneClass = {
    neutral: "border-gray-100 bg-white hover:border-brand-verde",
    warning: "border-amber-100 bg-amber-50/70 hover:border-amber-300",
    danger: "border-red-100 bg-red-50/80 hover:border-red-300",
    success: "border-emerald-100 bg-emerald-50/70 hover:border-emerald-300",
  }[tone];

  const iconClass = {
    neutral: "bg-gray-100 text-gray-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-red-100 text-red-700",
    success: "bg-emerald-100 text-emerald-700",
  }[tone];

  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-[86px] items-center gap-4 rounded-lg border p-4 transition",
        toneClass
      )}
    >
      <div className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg", iconClass)}>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-semibold text-gray-900">{title}</p>
          <span className="text-lg font-bold tabular-nums text-gray-900">
            {isLoading ? "..." : numberFmt.format(count)}
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-gray-500">{detail}</p>
      </div>
      <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-brand-verde" />
    </Link>
  );
}

export function DashboardActionCenter({ role, actions, isLoading = false }: DashboardActionCenterProps) {
  const isCommercial = role === "COMMERCIAL";
  const isFinance = role === "FINANCE";

  const rows: ActionRowProps[] = isCommercial
    ? [
        {
          href: "/dashboard/invoices?status=OVERDUE",
          icon: AlertCircle,
          title: "Resolver invoices em aberto",
          detail: "Enviadas, vencidas ou parcialmente pagas na sua carteira.",
          count: actions.openInvoiceCount,
          tone: actions.openInvoiceCount > 0 ? "danger" : "success",
        },
        {
          href: "/dashboard/contracts",
          icon: FileSignature,
          title: "Contratos aguardando assinatura",
          detail: "Clientes que precisam de follow-up antes do operacional.",
          count: actions.pendingContractCount,
          tone: actions.pendingContractCount > 0 ? "warning" : "success",
        },
        {
          href: "/dashboard/deals",
          icon: Target,
          title: "Negocios abertos",
          detail: "Pipeline ativo sob sua responsabilidade.",
          count: actions.openDealCount,
          tone: "neutral",
        },
      ]
    : isFinance
    ? [
        {
          href: "/dashboard/invoices?status=OVERDUE",
          icon: AlertCircle,
          title: "Risco de cobranca",
          detail: "Invoices vencidas, enviadas ou parcialmente pagas.",
          count: actions.openInvoiceCount,
          tone: actions.openInvoiceCount > 0 ? "danger" : "success",
        },
        {
          href: "/dashboard/invoices?status=PARTIALLY_PAID",
          icon: CreditCard,
          title: "Pagamentos parciais",
          detail: "Valores que precisam de baixa, complemento ou follow-up.",
          count: actions.partialInvoiceCount,
          tone: actions.partialInvoiceCount > 0 ? "warning" : "success",
        },
        {
          href: "/dashboard/invoices",
          icon: CheckCircle2,
          title: "Auto-charge com atencao",
          detail: "Tentativas falhas ou em retry para revisar.",
          count: actions.autoChargeRiskCount,
          tone: actions.autoChargeRiskCount > 0 ? "warning" : "success",
        },
      ]
    : [
        {
          href: "/dashboard/invoices?status=OVERDUE",
          icon: AlertCircle,
          title: "Financeiro em risco",
          detail: "Invoices abertas, vencidas ou parcialmente pagas.",
          count: actions.openInvoiceCount,
          tone: actions.openInvoiceCount > 0 ? "danger" : "success",
        },
        {
          href: "/dashboard/contracts",
          icon: FileSignature,
          title: "Contratos pendentes",
          detail: "Assinaturas que ainda bloqueiam o fluxo.",
          count: actions.pendingContractCount,
          tone: actions.pendingContractCount > 0 ? "warning" : "success",
        },
        {
          href: "/dashboard/leads",
          icon: Users,
          title: "Leads qualificados",
          detail: "Oportunidades prontas para avancar.",
          count: actions.qualifiedLeadCount,
          tone: "neutral",
        },
        {
          href: "/dashboard/customers",
          icon: Link2Off,
          title: "Clientes sem QuickBooks",
          detail: "Cadastros que precisam de integracao ou sync.",
          count: actions.quickbooksGapCount,
          tone: actions.quickbooksGapCount > 0 ? "warning" : "success",
        },
      ];

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-verde">Central de acoes</p>
          <h2 className="text-lg font-semibold text-gray-900">O que precisa de atencao agora</h2>
        </div>
        <p className="text-xs text-gray-500">Fila atual, independente do periodo do BI.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {rows.map((row) => (
          <ActionRow key={row.title} {...row} isLoading={isLoading} />
        ))}
      </div>
    </section>
  );
}
