import type { z } from 'zod';
import type { UserRole } from '@prisma/client';
import type { ToolContext } from '../types';

export interface AiToolDefinition<TArgs = unknown, TResult = unknown> {
  name: string;
  description: string;
  allowedRoles: UserRole[];
  inputSchema: z.ZodType<TArgs>;
  handler: (args: TArgs, ctx: ToolContext) => Promise<TResult>;
}

export function defineAiTool<TArgs, TResult>(
  def: AiToolDefinition<TArgs, TResult>
): AiToolDefinition<TArgs, TResult> {
  return def;
}

export function requireRole(actual: UserRole, allowed: UserRole[]): void {
  if (!allowed.includes(actual)) {
    throw new Error(
      `Acesso negado: role ${actual} não pode executar esta ferramenta (requer: ${allowed.join(', ')})`
    );
  }
}
