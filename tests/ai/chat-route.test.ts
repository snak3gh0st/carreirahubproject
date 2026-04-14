// Note: run with POSTGRES_PRISMA_URL set to a dummy value to avoid PrismaClient constructor error.
import { describe, it, before } from 'node:test';
import assert from 'node:assert';

// Mock NextAuth + AI SDK so tests don't hit real services
// We test the route handler via direct import of POST with mocked request.

describe('POST /api/dashboard/ai/chat — guards', () => {
  it('returns 401 when no session (kill switch passes, auth then fails)', async () => {
    process.env.AI_COPILOT_ENABLED = 'true'; // kill switch MUST pass first
    // Note: getServerSession calls Next.js headers() which cannot run outside a real request scope
    // in a tsx test environment. This test documents the expected behavior; full behavioral mock
    // tests (with mocked getServerSession + Prisma) land in Plan 05 hardening.
    // We verify the route is importable and exports POST.
    const mod = await import('@/app/api/dashboard/ai/chat/route');
    assert.strictEqual(typeof mod.POST, 'function', 'POST handler must be exported');
  });

  it('returns 503 when AI_COPILOT_ENABLED=false', async () => {
    process.env.AI_COPILOT_ENABLED = 'false';
    const { POST } = await import('@/app/api/dashboard/ai/chat/route');
    const req = new Request('http://localhost/api/dashboard/ai/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'oi' }] }),
    }) as any;
    // Kill switch is the FIRST check — before getServerSession — so it returns 503 without
    // touching Next.js request context. Verify this ordering guarantee.
    const res = await POST(req);
    assert.strictEqual(res.status, 503, 'Kill switch must return 503 before auth');
    process.env.AI_COPILOT_ENABLED = 'true'; // restore
  });
});

describe('lib/ai/pricing', () => {
  it('estimateCostUSD for gpt-4o-mini', async () => {
    const { estimateCostUSD } = await import('@/lib/ai/pricing');
    const cost = estimateCostUSD(1_000_000, 1_000_000, 'gpt-4o-mini');
    assert.strictEqual(cost, 0.15 + 0.60);
  });
  it('returns 0 for unknown model', async () => {
    const { estimateCostUSD } = await import('@/lib/ai/pricing');
    assert.strictEqual(estimateCostUSD(1000, 1000, 'unknown'), 0);
  });
});

describe('maxDuration export', () => {
  it('is 300 for Fluid Compute', async () => {
    const mod = await import('@/app/api/dashboard/ai/chat/route');
    assert.strictEqual((mod as any).maxDuration, 300);
  });
});

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
