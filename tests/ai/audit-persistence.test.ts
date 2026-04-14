import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { PrismaClient, AiMessageRole } from '@prisma/client';

const prisma = new PrismaClient();
const TEST_USER_ID = 'audit-test-' + Date.now();

async function setup() {
  await prisma.user.upsert({
    where: { email: `${TEST_USER_ID}@test.local` },
    update: {},
    create: { id: TEST_USER_ID, email: `${TEST_USER_ID}@test.local`, role: 'ADMIN' },
  });
}
async function cleanup() {
  await prisma.aiMessage.deleteMany({ where: { conversation: { userId: TEST_USER_ID } } }).catch(() => {});
  await prisma.aiConversation.deleteMany({ where: { userId: TEST_USER_ID } }).catch(() => {});
  await prisma.aiRateLimit.deleteMany({ where: { userId: TEST_USER_ID } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } }).catch(() => {});
}

describe('Audit persistence schema', () => {
  before(async () => { await cleanup(); await setup(); });
  after(async () => { await cleanup(); });

  it('can create conversation + USER + TOOL + ASSISTANT messages with correct fields', async () => {
    const conv = await prisma.aiConversation.create({
      data: { userId: TEST_USER_ID, title: 'Teste' },
    });

    await prisma.aiMessage.create({
      data: { conversationId: conv.id, role: AiMessageRole.USER, content: 'Quantas faturas vencidas?' },
    });
    await prisma.aiMessage.create({
      data: {
        conversationId: conv.id, role: AiMessageRole.TOOL,
        content: '', toolName: 'getOverdueInvoices',
        toolArgs: { minDaysOverdue: 1 } as any,
        toolResult: { count: 3, totalAmount: 1500 } as any,
        modelUsed: 'gpt-4o-mini',
      },
    });
    await prisma.aiMessage.create({
      data: {
        conversationId: conv.id, role: AiMessageRole.ASSISTANT,
        content: 'Você tem 3 faturas vencidas totalizando R$ 1.500,00.',
        tokensIn: 250, tokensOut: 45, modelUsed: 'gpt-4o-mini', latencyMs: 1200,
      },
    });

    const messages = await prisma.aiMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: 'asc' },
    });
    assert.strictEqual(messages.length, 3);
    assert.strictEqual(messages[0].role, 'USER');
    assert.strictEqual(messages[1].role, 'TOOL');
    assert.strictEqual(messages[2].role, 'ASSISTANT');
    assert.strictEqual(messages[1].toolName, 'getOverdueInvoices');
    assert.strictEqual(messages[2].tokensIn, 250);
    assert.strictEqual(messages[2].tokensOut, 45);
    assert.strictEqual(messages[2].modelUsed, 'gpt-4o-mini');
    assert.strictEqual(messages[2].latencyMs, 1200);
  });

  it('cascade deletes messages when conversation deleted', async () => {
    const conv = await prisma.aiConversation.create({ data: { userId: TEST_USER_ID, title: 'Cascade' } });
    await prisma.aiMessage.create({ data: { conversationId: conv.id, role: 'USER', content: 'x' } });
    await prisma.aiConversation.delete({ where: { id: conv.id } });
    const remaining = await prisma.aiMessage.count({ where: { conversationId: conv.id } });
    assert.strictEqual(remaining, 0);
  });
});
