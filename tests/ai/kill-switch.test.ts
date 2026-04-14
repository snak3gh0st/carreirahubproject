import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('AI_COPILOT_ENABLED kill switch', () => {
  it('chat route returns 503 when kill switch is off', async () => {
    const prev = process.env.AI_COPILOT_ENABLED;
    process.env.AI_COPILOT_ENABLED = 'false';
    // Re-import to ensure env is read fresh if module memoized it
    // (Current route.ts reads env at request time, so single import is fine)
    const { POST } = await import('@/app/api/dashboard/ai/chat/route');

    // Supply a minimally valid-looking request; kill switch is FIRST check
    // before getServerSession — so it returns 503 without touching Next.js request context.
    const req = new Request('http://localhost/api/dashboard/ai/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'oi' }] }),
    }) as any;
    const res = await POST(req);
    assert.strictEqual(res.status, 503, 'Kill switch must return 503 before auth');
    const body = await res.json();
    assert.match(body.error ?? '', /desativado|disabled/i);
    process.env.AI_COPILOT_ENABLED = prev;
  });

  it('chat route does NOT return 503 when kill switch is on', async () => {
    const prev = process.env.AI_COPILOT_ENABLED;
    process.env.AI_COPILOT_ENABLED = 'true';
    const { POST } = await import('@/app/api/dashboard/ai/chat/route');

    // When kill switch is on, the route proceeds past the kill switch check and calls
    // getServerSession which requires Next.js request context (not available in tsx tests).
    // We verify this by confirming the route does NOT return 503 (kill switch is not the blocker).
    // The error will be a request-scope error from getServerSession, not a 503.
    const req = new Request('http://localhost/api/dashboard/ai/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'oi' }] }),
    }) as any;
    let didNotReturn503 = false;
    try {
      const res = await POST(req);
      assert.notStrictEqual(res.status, 503, 'When enabled, should not 503');
      didNotReturn503 = true;
    } catch (err) {
      // getServerSession throws when called outside Next.js request scope.
      // This confirms the kill switch is NOT the blocker — execution reached auth.
      const message = (err as Error).message ?? String(err);
      assert.ok(
        message.includes('headers') || message.includes('request scope') || message.includes('dynamic'),
        `Expected Next.js request-scope error, got: ${message}`
      );
      didNotReturn503 = true;
    }
    assert.ok(didNotReturn503, 'Test should have reached this point (kill switch was not blocker)');
    process.env.AI_COPILOT_ENABLED = prev;
  });
});
