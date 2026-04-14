import { describe, it } from 'node:test';
import assert from 'node:assert';
import { z } from 'zod';
import { defineAiTool, requireRole } from '@/lib/ai/tools/_base';

describe('defineAiTool', () => {
  it('returns the input definition unchanged', () => {
    const def = defineAiTool({
      name: 'testTool',
      description: 'test',
      allowedRoles: ['ADMIN'] as any,
      inputSchema: z.object({ x: z.number() }),
      handler: async ({ x }) => ({ doubled: x * 2 }),
    });
    assert.strictEqual(def.name, 'testTool');
    assert.deepStrictEqual(def.allowedRoles, ['ADMIN']);
  });
});

describe('requireRole', () => {
  it('throws when role not in allowed list', () => {
    assert.throws(() => requireRole('SDR' as any, ['ADMIN', 'FINANCE'] as any), /Acesso negado/);
  });
  it('does not throw when role is allowed', () => {
    assert.doesNotThrow(() => requireRole('ADMIN' as any, ['ADMIN', 'FINANCE'] as any));
  });
});
