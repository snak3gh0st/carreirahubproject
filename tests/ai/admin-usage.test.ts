import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('GET /api/dashboard/ai/admin/usage — guards', () => {
  it('exports GET function', async () => {
    const mod = await import('@/app/api/dashboard/ai/admin/usage/route');
    assert.strictEqual(typeof (mod as any).GET, 'function');
  });
});

describe('GET /api/dashboard/ai/conversations', () => {
  it('exports GET and DELETE functions', async () => {
    const mod = await import('@/app/api/dashboard/ai/conversations/route');
    assert.strictEqual(typeof (mod as any).GET, 'function');
    assert.strictEqual(typeof (mod as any).DELETE, 'function');
  });
});

describe('GET /api/dashboard/ai/conversations/[id]', () => {
  it('exports GET function', async () => {
    const mod = await import('@/app/api/dashboard/ai/conversations/[id]/route');
    assert.strictEqual(typeof (mod as any).GET, 'function');
  });
});
