export const OPS_VISIBILITIES = ["INTERNAL", "STUDENT_VISIBLE"] as const;
export type OpsVisibility = (typeof OPS_VISIBILITIES)[number];

export const OPS_COMMENT_CATEGORIES = [
  "COMERCIAL",
  "FINANCEIRO",
  "SUPORTE",
  "ESCRITA",
  "TECNICO",
  "JURIDICO",
] as const;
export type OpsCommentCategory = (typeof OPS_COMMENT_CATEGORIES)[number];

export const OPS_STUDENT_DOCUMENT_KINDS = [
  "CV_ORIGINAL",
  "CV_FINAL",
  "COVER_LETTER_ORIGINAL",
  "COVER_LETTER_FINAL",
  "CANVA_LINK",
  "STUDENT_MATERIAL",
  "SUPPORT_MATERIAL",
  "CONTRACT_PDF",
  "FORM_PDF",
  "OTHER",
] as const;
export type OpsStudentDocumentKind = (typeof OPS_STUDENT_DOCUMENT_KINDS)[number];

export const OPS_DOCUMENT_RESOURCE_TYPES = ["FILE", "EXTERNAL_LINK"] as const;
export type OpsDocumentResourceType = (typeof OPS_DOCUMENT_RESOURCE_TYPES)[number];

export const OPS_DOCUMENT_STATUSES = [
  "UPLOADED",
  "PARSED",
  "NEEDS_REVIEW",
  "REVIEWED",
  "FINAL",
] as const;
export type OpsDocumentStatus = (typeof OPS_DOCUMENT_STATUSES)[number];

export const OPS_ACTIVITY_TYPES = [
  "APPLICATION",
  "INTERVIEW",
  "TASK",
  "OFFER",
  "JOB_PLACED",
  "VACANCY_REVIEW",
  "MOCK_INTERVIEW",
  "SUPPORT_SALE",
  "OTHER",
] as const;
export type OpsActivityType = (typeof OPS_ACTIVITY_TYPES)[number];

export const OPS_ACTIVITY_STATUSES = [
  "PENDENTE",
  "EM_PROCESSO",
  "CONCLUIDO",
  "PASSOU",
  "NAO_PASSOU",
  "NO_SHOW",
  "REMARCADO",
  "CANCELADO",
  "OFERTA",
  "RECOLOCADO",
  "PERDIDO",
] as const;
export type OpsActivityStatus = (typeof OPS_ACTIVITY_STATUSES)[number];

export const OPS_SESSION_STATUSES = ["REALIZADO", "NO_SHOW", "REMARCADO", "CANCELADO"] as const;
export type OpsSessionStatus = (typeof OPS_SESSION_STATUSES)[number];

export const OPS_SENIORITY_LEVELS = ["ENTRY_LEVEL", "MID_LEVEL", "SENIOR", "DIRECTOR"] as const;
export type OpsSeniorityLevel = (typeof OPS_SENIORITY_LEVELS)[number];

export function normalizeOpsVisibility(value: unknown): OpsVisibility {
  return OPS_VISIBILITIES.includes(value as OpsVisibility)
    ? (value as OpsVisibility)
    : "INTERNAL";
}

export function normalizeOpsCommentCategory(value: unknown): OpsCommentCategory {
  return OPS_COMMENT_CATEGORIES.includes(value as OpsCommentCategory)
    ? (value as OpsCommentCategory)
    : "SUPORTE";
}

export function normalizeOpsActivityStatus(value: unknown): OpsActivityStatus | null {
  return OPS_ACTIVITY_STATUSES.includes(value as OpsActivityStatus)
    ? (value as OpsActivityStatus)
    : null;
}

export function normalizeOpsSessionStatus(value: unknown): OpsSessionStatus {
  return OPS_SESSION_STATUSES.includes(value as OpsSessionStatus)
    ? (value as OpsSessionStatus)
    : "REALIZADO";
}
