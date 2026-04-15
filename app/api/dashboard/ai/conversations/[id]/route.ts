import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getAiHubBySlug, getAiHubKeyBySlug, isRoleAllowedForHub } from '@/lib/ai/hub-config';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string; role?: string } | undefined;
  if (!session || !sessionUser?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = sessionUser.id!;
  const hubSlug = new URL(req.url).searchParams.get('hub');
  const hub = hubSlug ? getAiHubBySlug(hubSlug) : null;
  if (!hubSlug || !hub) {
    return NextResponse.json({ error: 'hub inválido' }, { status: 400 });
  }
  if (!isRoleAllowedForHub(String(sessionUser.role), hubSlug)) {
    return NextResponse.json({ error: 'Acesso negado para este hub' }, { status: 403 });
  }
  const hubKey = getAiHubKeyBySlug(hub.slug);
  if (!hubKey) {
    return NextResponse.json({ error: 'hub inválido' }, { status: 400 });
  }

  const conversation = await prisma.aiConversation.findFirst({
    where: { id: params.id, userId, hub: hubKey },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!conversation) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      title: conversation.title ?? 'Nova conversa',
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    },
    messages: conversation.messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      toolName: m.toolName,
      toolArgs: m.toolArgs,
      toolResult: m.toolResult,
      createdAt: m.createdAt.toISOString(),
      tokensIn: m.tokensIn,
      tokensOut: m.tokensOut,
      latencyMs: m.latencyMs,
      errorMessage: m.errorMessage,
    })),
  });
}
