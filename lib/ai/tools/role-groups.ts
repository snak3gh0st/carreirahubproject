import { UserRole } from "@prisma/client";

export const OPERATIONAL_AI_ROLES = [
  UserRole.ADMIN,
  UserRole.OPERATIONAL,
  UserRole.HEAD_OPERACIONAL,
];

export const ALL_AI_ROLES = [
  UserRole.ADMIN,
  UserRole.FINANCE,
  UserRole.OPERATIONAL,
  UserRole.HEAD_OPERACIONAL,
  UserRole.COMMERCIAL,
  UserRole.HEAD_COMERCIAL,
];
