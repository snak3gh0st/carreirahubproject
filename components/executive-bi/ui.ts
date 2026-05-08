import type {
  ExecutiveAreaKey,
  ExecutiveAreaSummary,
  ExecutiveDecisionItem,
  ExecutiveFreshness,
} from "@/lib/types/executive-bi";

export const EXECUTIVE_AREA_ORDER: ExecutiveAreaKey[] = ["finance", "sales", "operations", "ai"];

export function getExecutiveAreaLabel(area: ExecutiveAreaKey): string {
  if (area === "sales") return "Commercial & Clients";
  return area === "ai" ? "AI" : area[0].toUpperCase() + area.slice(1);
}

export function formatExecutiveCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function getDecisionSeverityTone(severity: ExecutiveDecisionItem["severity"]): string {
  if (severity === "high") return "bg-red-50 text-red-700 ring-1 ring-red-100";
  if (severity === "medium") return "bg-brand-tangerina/10 text-brand-tangerina ring-1 ring-brand-tangerina/20";
  return "bg-brand-verde/10 text-brand-verde ring-1 ring-brand-verde/15";
}

export function getFreshnessTone(state: ExecutiveFreshness["state"]): string {
  if (state === "fresh") return "bg-brand-verde/10 text-brand-verde";
  if (state === "partial") return "bg-brand-tangerina/10 text-brand-tangerina";
  if (state === "stale") return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

export function getAreaStatusTone(status: ExecutiveAreaSummary["status"]): string {
  if (status === "risk") return "bg-red-50 text-red-700";
  if (status === "watch") return "bg-brand-tangerina/10 text-brand-tangerina";
  return "bg-brand-verde/10 text-brand-verde";
}
