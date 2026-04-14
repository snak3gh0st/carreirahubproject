// Note: run with POSTGRES_PRISMA_URL set to a dummy value to avoid PrismaClient constructor error.
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('POST /api/dashboard/ai/chat (Wave 0 stub)', () => {
  it('foundation exports exist', async () => {
    const base = await import('@/lib/ai/tools/_base');
    const registry = await import('@/lib/ai/tools');
    const rateLimit = await import('@/lib/ai/rate-limit');
    const prompt = await import('@/lib/ai/prompts/system.pt-br');
    assert.strictEqual(typeof base.defineAiTool, 'function');
    assert.strictEqual(typeof registry.allowedToolsForRole, 'function');
    assert.strictEqual(typeof rateLimit.checkRateLimit, 'function');
    assert.strictEqual(typeof prompt.buildSystemPrompt, 'function');
  });

  it('system prompt contains read-only + PT-BR markers', () => {
    const { buildSystemPrompt } = require('@/lib/ai/prompts/system.pt-br');
    const p = buildSystemPrompt({
      userName: 'Paulo', userRole: 'ADMIN', currentDate: '2026-04-14',
      pageContext: 'Usuário está em /dashboard', toolNames: ['getInvoices'],
    });
    assert.match(p, /SOMENTE LEITURA/);
    assert.match(p, /português brasileiro/);
    assert.match(p, /Paulo/);
    assert.match(p, /ADMIN/);
  });
});
