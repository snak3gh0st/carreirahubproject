import type { UserRole } from "@prisma/client";

export const HEAD_OPERACIONAL_ROLE = "HEAD_OPERACIONAL" as const;

export const OPERATIONAL_ACCESS_ROLES = [
  "ADMIN",
  "OPERATIONAL",
  HEAD_OPERACIONAL_ROLE,
] as const satisfies readonly UserRole[];

export const OPERATIONAL_MANAGER_ROLES = [
  "ADMIN",
  HEAD_OPERACIONAL_ROLE,
] as const satisfies readonly UserRole[];

export const OPERATIONAL_TEAM_ROLES = [
  "OPERATIONAL",
  HEAD_OPERACIONAL_ROLE,
] as const satisfies readonly UserRole[];

export function isOperationalAccessRole(
  role: string | null | undefined,
): role is (typeof OPERATIONAL_ACCESS_ROLES)[number] {
  return (OPERATIONAL_ACCESS_ROLES as readonly string[]).includes(role ?? "");
}

export function isOperationalManagerRole(
  role: string | null | undefined,
): role is (typeof OPERATIONAL_MANAGER_ROLES)[number] {
  return (OPERATIONAL_MANAGER_ROLES as readonly string[]).includes(role ?? "");
}

export function isOperationalTeamRole(
  role: string | null | undefined,
): role is (typeof OPERATIONAL_TEAM_ROLES)[number] {
  return (OPERATIONAL_TEAM_ROLES as readonly string[]).includes(role ?? "");
}

export function shouldScopeOperationalWork(
  role: string | null | undefined,
): boolean {
  return role === "OPERATIONAL";
}
