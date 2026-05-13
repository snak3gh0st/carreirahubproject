import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  Clock,
  DollarSign,
  FileText,
  RefreshCw,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import { authOptions } from "@/lib/auth";
import {
  getCommercialBIData,
  type CommercialBIResponse,
  type CommercialBISellerMetric,
} from "@/lib/services/commercial-bi";
import { cn } from "@/lib/utils/cn";

type CommercialBIPageProps = {
  searchParams: {
    dateRange?: string;
    from?: string;
    to?: string;
    product?: string;
    payment?: string;
  };
};

const RANGE_OPTIONS = [
  { value: "thisMonth", label: "MTD" },
  { value: "lastMonth", label: "Mês ant." },
  { value: "last7", label: "7d" },
  { value: "last30", label: "30d" },
  { value: "last90", label: "90d" },
  { value: "thisYear", label: "Ano" },
  { value: "allTime", label: "Tudo" },
] as const;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "Sem sync";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

function rangeHref(value: string, product?: string, payment?: string): string {
  const params = new URLSearchParams({ dateRange: value });
  if (product) params.set("product", product);
  if (payment) params.set("payment", payment);
  return `/dashboard/commercial-bi?${params.toString()}`;
}

function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone?: "neutral" | "green" | "amber" | "blue" | "red";
}) {
  const toneClasses = {
    neutral: "bg-gray-50 text-gray-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-700",
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-md", toneClasses[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-2xl font-semibold tabular-nums text-gray-950">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{helper}</p>
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
      {label}
    </div>
  );
}

function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const width = max > 0 ? Math.max(4, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-gray-100">
      <div className={cn("h-2 rounded-full bg-brand-verde", className)} style={{ width: `${width}%` }} />
    </div>
  );
}

function SellerPerformance({
  sellers,
}: {
  sellers: CommercialBISellerMetric[];
}) {
  const maxWon = Math.max(...sellers.map((seller) => seller.wonValue), 0);
  const maxPipeline = Math.max(...sellers.map((seller) => seller.openPipelineValue), 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-lg font-semibold text-gray-950">Performance por vendedor</h2>
        <p className="text-sm text-gray-500">Ranking do time comercial com carteira, fechamento e pendências.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-5 py-3 text-left font-semibold">Vendedor</th>
              <th className="px-4 py-3 text-right font-semibold">Leads</th>
              <th className="px-4 py-3 text-right font-semibold">Pipeline</th>
              <th className="px-4 py-3 text-right font-semibold">Fechado</th>
              <th className="px-4 py-3 text-right font-semibold">Conversão</th>
              <th className="px-4 py-3 text-right font-semibold">Ticket</th>
              <th className="px-4 py-3 text-right font-semibold">Pendências</th>
              <th className="px-4 py-3 text-right font-semibold">Clint</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sellers.map((seller) => (
              <tr key={seller.sellerId} className="align-top">
                <td className="px-5 py-4">
                  <p className="font-semibold text-gray-950">{seller.sellerName}</p>
                  <p className="text-xs text-gray-500">{seller.sellerEmail}</p>
                </td>
                <td className="px-4 py-4 text-right tabular-nums text-gray-700">
                  {seller.leads}
                  <span className="ml-1 text-xs text-gray-400">({seller.qualifiedLeads} qual.)</span>
                </td>
                <td className="px-4 py-4">
                  <div className="ml-auto w-40">
                    <p className="mb-1 text-right tabular-nums text-gray-900">{formatCurrency(seller.openPipelineValue)}</p>
                    <ProgressBar value={seller.openPipelineValue} max={maxPipeline} className="bg-blue-500" />
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="ml-auto w-40">
                    <p className="mb-1 text-right tabular-nums text-gray-900">{formatCurrency(seller.wonValue)}</p>
                    <ProgressBar value={seller.wonValue} max={maxWon} />
                  </div>
                </td>
                <td className="px-4 py-4 text-right tabular-nums text-gray-700">{seller.conversionRate}%</td>
                <td className="px-4 py-4 text-right tabular-nums text-gray-700">{formatCurrency(seller.avgDealValue)}</td>
                <td className="px-4 py-4 text-right tabular-nums text-gray-700">
                  {seller.pendingInvoices + seller.pendingContracts}
                  <p className="text-xs text-gray-400">{formatCurrency(seller.pendingInvoiceAmount)}</p>
                </td>
                <td className="px-4 py-4 text-right tabular-nums text-gray-700">{seller.clintLinkedDeals}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SourceBreakdown({ data }: { data: CommercialBIResponse["sourceBreakdown"] }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-950">Origem dos leads</h2>
        <p className="text-sm text-gray-500">Qualidade e conversão por canal.</p>
      </div>
      <div className="space-y-3">
        {data.length === 0 ? (
          <EmptyRow label="Sem leads no período." />
        ) : (
          data.slice(0, 8).map((source) => (
            <div key={source.source} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-gray-100 px-3 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">{source.source}</p>
                <p className="text-xs text-gray-500">
                  {source.qualified} qualificados, {source.converted} convertidos
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums text-gray-950">{source.leads}</p>
                <p className="text-xs text-gray-500">score {source.avgScore ?? "-"}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ActionQueue({ data }: { data: CommercialBIResponse["actionQueue"] }) {
  const staleDeals = data.staleDeals.slice(0, 5);
  const pendingInvoices = data.pendingInvoices.slice(0, 5);
  const handoffGaps = [...data.wonWithoutContract, ...data.wonWithoutInvoice].slice(0, 5);

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-600" />
          <h2 className="text-base font-semibold text-gray-950">Deals parados</h2>
        </div>
        <div className="space-y-2">
          {staleDeals.length === 0 ? (
            <EmptyRow label="Sem deals parados acima de 14 dias." />
          ) : (
            staleDeals.map((deal) => (
              <div key={deal.id} className="rounded-md border border-amber-100 bg-amber-50/40 p-3">
                <p className="truncate text-sm font-semibold text-gray-950">{deal.title}</p>
                <p className="mt-1 text-xs text-gray-600">
                  {deal.sellerName} · {formatCurrency(deal.value)} · {deal.daysStale} dias
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-red-600" />
          <h2 className="text-base font-semibold text-gray-950">Invoices abertas</h2>
        </div>
        <div className="space-y-2">
          {pendingInvoices.length === 0 ? (
            <EmptyRow label="Sem invoices comerciais pendentes." />
          ) : (
            pendingInvoices.map((invoice) => (
              <div key={invoice.id} className="rounded-md border border-red-100 bg-red-50/40 p-3">
                <p className="truncate text-sm font-semibold text-gray-950">{invoice.invoiceNumber}</p>
                <p className="mt-1 text-xs text-gray-600">
                  {invoice.sellerName} · {formatCurrency(invoice.openAmount)}
                  {invoice.daysOverdue ? ` · ${invoice.daysOverdue} dias vencida` : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-blue-600" />
          <h2 className="text-base font-semibold text-gray-950">Handoff comercial</h2>
        </div>
        <div className="space-y-2">
          {handoffGaps.length === 0 && data.unassignedOpenDeals.length === 0 ? (
            <EmptyRow label="Sem gaps de contrato, invoice ou dono no Clint." />
          ) : (
            <>
              {handoffGaps.map((deal) => (
                <div key={deal.id} className="rounded-md border border-blue-100 bg-blue-50/40 p-3">
                  <p className="truncate text-sm font-semibold text-gray-950">{deal.title}</p>
                  <p className="mt-1 text-xs text-gray-600">{deal.sellerName} · {formatCurrency(deal.value)}</p>
                </div>
              ))}
              {data.unassignedOpenDeals.slice(0, 3).map((deal) => (
                <div key={deal.id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <p className="truncate text-sm font-semibold text-gray-950">{deal.title}</p>
                  <p className="mt-1 text-xs text-gray-600">Sem vendedor · {formatCurrency(deal.value)}</p>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CloserBreakdown({ data }: { data: CommercialBIResponse["closerBreakdown"] }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-950">Closer por produto e pagamento</h2>
        <p className="text-sm text-gray-500">Performance de fechamento por oferta e método de pagamento.</p>
      </div>
      <div className="space-y-4">
        {data.map((seller) => (
          <div key={seller.sellerId} className="rounded-lg border border-gray-100 p-4">
            <p className="mb-3 text-base font-semibold text-gray-950">{seller.sellerName}</p>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Produtos</p>
                <div className="space-y-2">
                  {seller.products.length === 0 ? (
                    <EmptyRow label="Sem fechamentos por produto no período." />
                  ) : (
                    seller.products.slice(0, 6).map((item) => (
                      <div key={`${seller.sellerId}-${item.product}`} className="rounded-md border border-gray-100 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-gray-900">{item.product}</p>
                          <p className="text-sm font-semibold tabular-nums text-gray-900">{formatCurrency(item.wonValue)}</p>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {item.wonDeals} ganhos · {item.invoiceCount} invoices · pago {formatCurrency(item.paidAmount)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Formas de pagamento</p>
                <div className="space-y-2">
                  {seller.paymentMethods.length === 0 ? (
                    <EmptyRow label="Sem recebimentos por método no período." />
                  ) : (
                    seller.paymentMethods.slice(0, 6).map((item) => (
                      <div key={`${seller.sellerId}-${item.method}`} className="rounded-md border border-gray-100 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-gray-900">{item.method}</p>
                          <p className="text-sm font-semibold tabular-nums text-gray-900">{formatCurrency(item.paidAmount)}</p>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">{item.invoiceCount} invoices</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterPill({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-1.5 text-xs font-semibold transition",
        active ? "bg-brand-verde text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100",
      )}
    >
      {label}
    </Link>
  );
}

export default async function CommercialBIPage({ searchParams }: CommercialBIPageProps) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/auth/signin");
  }

  const role = String((session.user as any)?.role ?? "");
  // D-10: EXECUTIVE may deep-dive into the commercial BI from the executive
  // landing. Middleware (D-09) already enforces the perimeter; this is the
  // belt-and-suspenders layer 2.
  if (role !== "ADMIN" && role !== "HEAD_COMERCIAL" && role !== "EXECUTIVE") {
    redirect("/dashboard");
  }

  const dateRange = searchParams.dateRange || "last30";
  const selectedProduct = searchParams.product || "all";
  const selectedPayment = searchParams.payment || "all";
  const data = await getCommercialBIData({
    preset: dateRange,
    from: searchParams.from,
    to: searchParams.to,
  });
  const productOptions = Array.from(
    new Set(data.closerBreakdown.flatMap((seller) => seller.products.map((item) => item.product))),
  ).sort((a, b) => a.localeCompare(b));
  const paymentOptions = Array.from(
    new Set(data.closerBreakdown.flatMap((seller) => seller.paymentMethods.map((item) => item.method))),
  ).sort((a, b) => a.localeCompare(b));

  const filteredCloserBreakdown = data.closerBreakdown
    .map((seller) => ({
      ...seller,
      products: seller.products.filter((item) => selectedProduct === "all" || item.product === selectedProduct),
      paymentMethods: seller.paymentMethods.filter((item) => selectedPayment === "all" || item.method === selectedPayment),
    }))
    .filter((seller) => seller.products.length > 0 || seller.paymentMethods.length > 0);

  const freshnessTone =
    data.freshness.state === "fresh"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : data.freshness.state === "stale"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-gray-200 bg-gray-50 text-gray-700";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-5 py-7">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brand-verde">Head Comercial</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-950">BI Comercial</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-500">
              Visão de time para Ariela acompanhar vendedores, Clint, clientes, pipeline, contratos e invoices sem abrir o BI financeiro.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
            {RANGE_OPTIONS.map((option) => (
              <Link
                key={option.value}
                href={rangeHref(option.value, selectedProduct !== "all" ? selectedProduct : undefined, selectedPayment !== "all" ? selectedPayment : undefined)}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-semibold transition",
                  dateRange === option.value
                    ? "bg-brand-verde text-white"
                    : "text-gray-600 hover:bg-gray-50"
                )}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <KpiCard
            label="Pipeline aberto"
            value={formatCurrency(data.summary.openPipelineValue)}
            helper={`${formatNumber(data.summary.openDeals)} deals em aberto`}
            icon={Briefcase}
            tone="blue"
          />
          <KpiCard
            label="Fechado"
            value={formatCurrency(data.summary.wonValue)}
            helper={`${formatNumber(data.summary.wonDeals)} deals ganhos`}
            icon={DollarSign}
            tone="green"
          />
          <KpiCard
            label="Conversão"
            value={`${data.summary.conversionRate}%`}
            helper={`${data.summary.wonDeals} ganhos / ${data.summary.lostDeals} perdidos`}
            icon={TrendingUp}
            tone="green"
          />
          <KpiCard
            label="Vendedores"
            value={formatNumber(data.summary.sellerCount)}
            helper={`${formatNumber(data.summary.leadCount)} leads no período`}
            icon={Users}
          />
          <KpiCard
            label="Pendências"
            value={formatCurrency(data.summary.pendingInvoiceAmount)}
            helper={`${data.summary.pendingInvoices} invoices, ${data.summary.pendingContracts} contratos`}
            icon={AlertTriangle}
            tone={data.summary.pendingInvoiceAmount > 0 ? "amber" : "neutral"}
          />
          <div className={cn("rounded-lg border p-4 shadow-sm", freshnessTone)}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide">Clint sync</p>
              <RefreshCw className="h-4 w-4" />
            </div>
            <p className="text-base font-semibold">{formatDate(data.freshness.lastClintSync)}</p>
            <p className="mt-1 text-xs opacity-80">{data.freshness.summary}</p>
          </div>
        </div>

        {data.sellers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
            <BarChart3 className="mx-auto h-8 w-8 text-gray-300" />
            <h2 className="mt-3 text-lg font-semibold text-gray-950">Nenhum vendedor ativo encontrado</h2>
            <p className="mt-1 text-sm text-gray-500">Cadastre ou ative usuários com role Comercial para alimentar este BI.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <SellerPerformance sellers={data.sellers} />
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Filtro por produto</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <FilterPill
                      href={rangeHref(dateRange, undefined, selectedPayment !== "all" ? selectedPayment : undefined)}
                      label="Todos"
                      active={selectedProduct === "all"}
                    />
                    {productOptions.map((product) => (
                      <FilterPill
                        key={product}
                        href={rangeHref(dateRange, product, selectedPayment !== "all" ? selectedPayment : undefined)}
                        label={product}
                        active={selectedProduct === product}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Filtro por pagamento</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <FilterPill
                      href={rangeHref(dateRange, selectedProduct !== "all" ? selectedProduct : undefined, undefined)}
                      label="Todos"
                      active={selectedPayment === "all"}
                    />
                    {paymentOptions.map((payment) => (
                      <FilterPill
                        key={payment}
                        href={rangeHref(dateRange, selectedProduct !== "all" ? selectedProduct : undefined, payment)}
                        label={payment}
                        active={selectedPayment === payment}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <CloserBreakdown data={filteredCloserBreakdown} />
            <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
              <SourceBreakdown data={data.sourceBreakdown} />
              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-950">Resumo por vendedor</h2>
                <p className="mb-4 text-sm text-gray-500">Leitura rápida para 1:1 e cobrança de follow-up.</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {data.sellers.map((seller) => (
                    <div key={seller.sellerId} className="rounded-lg border border-gray-100 p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-950">{seller.sellerName}</p>
                          <p className="text-xs text-gray-500">{seller.openDeals} abertos · {seller.staleOpenDeals} parados</p>
                        </div>
                        <span className="rounded-md bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-600">
                          {seller.conversionRate}%
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-400">Pipeline</p>
                          <p className="font-semibold text-gray-900">{formatCurrency(seller.openPipelineValue)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Fechado</p>
                          <p className="font-semibold text-gray-900">{formatCurrency(seller.wonValue)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Pendente</p>
                          <p className="font-semibold text-gray-900">{formatCurrency(seller.pendingInvoiceAmount)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <ActionQueue data={data.actionQueue} />
          </div>
        )}
      </div>
    </div>
  );
}
