import type { UserRole } from '@prisma/client';
import type { AiToolDefinition } from './_base';

// Wave 1 (Plan 02) appends tool modules here.
// Each tool export is imported below and added to the registry array.
export const toolRegistry: AiToolDefinition<unknown, unknown>[] = [
  // Finance
  // Students / Ops
  // Leads
  // Contracts
  // Meta / Utility
];

export function allowedToolsForRole(
  role: UserRole
): AiToolDefinition<unknown, unknown>[] {
  return toolRegistry.filter((t) => t.allowedRoles.includes(role));
}
