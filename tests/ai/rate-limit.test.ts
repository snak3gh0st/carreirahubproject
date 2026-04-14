import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { PrismaClient } from '@prisma/client';
import { checkRateLimit } from '@/lib/ai/rate-limit';

const prisma = new PrismaClient();
const TEST_USER_ID = 'rl-test-' + Date.now();

// Create a test User to satisfy FK constraint
async function ensureUser() {
  await prisma.user.upsert({
    where: { email: `${TEST_USER_ID}@test.local` },
    update: {},
    create: { id: TEST_USER_ID, email: `${TEST_USER_ID}@test.local`, role: 'ADMIN' },
  });
}
async function cleanup() {
  await prisma.aiRateLimit.deleteMany({ where: { userId: TEST_USER_ID } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } }).catch(() => {});
}

describe('checkRateLimit', () => {
  beforeEach(async () => { await cleanup(); await ensureUser(); });
  afterEach(async () => { await cleanup(); });

  it('allows first 50 calls within window', async () => {
    for (let i = 1; i <= 50; i++) {
      const r = await checkRateLimit(TEST_USER_ID, 50);
      assert.strictEqual(r.allowed, true, `call #${i} should be allowed`);
    }
  });

  it('blocks 51st call and returns retryAfterSec > 0', async () => {
    for (let i = 1; i <= 50; i++) await checkRateLimit(TEST_USER_ID, 50);
    const r = await checkRateLimit(TEST_USER_ID, 50);
    assert.strictEqual(r.allowed, false);
    assert.ok(r.retryAfterSec > 0, 'retryAfterSec must be > 0 when blocked');
  });

  it('resets window when windowStart is older than 1h', async () => {
    await checkRateLimit(TEST_USER_ID, 50);
    // Force window start to 2h ago
    await prisma.aiRateLimit.update({
      where: { userId: TEST_USER_ID },
      data: { windowStart: new Date(Date.now() - 2 * 3600_000), count: 50 },
    });
    const r = await checkRateLimit(TEST_USER_ID, 50);
    assert.strictEqual(r.allowed, true, 'window reset should allow the call');
  });
});
