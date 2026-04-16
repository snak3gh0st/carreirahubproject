import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getAiHubBySlug, getAiHubKeyBySlug, isRoleAllowedForHub } from '@/lib/ai/hub-config';

export async function GET(req: NextRequest) {
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

  const conversations = await prisma.aiConversation.findMany({
    where: { userId, hub: hubKey },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, title: true, createdAt: true, updatedAt: true,
      _count: { select: { messages: true } },
    },
  });
  return NextResponse.json({
    conversations: conversations.map(c => ({
      id: c.id, title: c.title ?? 'Nova conversa',
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      messageCount: c._count.messages,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string; role?: string } | undefined;
  if (!session || !sessionUser?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = sessionUser.id!;

  let body: { hub?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const hubSlug = body.hub;
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

  const conversation = await prisma.aiConversation.create({
    data: {
      userId,
      hub: hubKey,
      title: body.title?.trim() || 'Nova conversa',
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      title: conversation.title ?? 'Nova conversa',
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string; role?: string } | undefined;
  if (!session || !sessionUser?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = sessionUser.id!;
  const searchParams = new URL(req.url).searchParams;
  const id = searchParams.get('id');
  const hubSlug = searchParams.get('hub');
  const hub = hubSlug ? getAiHubBySlug(hubSlug) : null;
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
  if (!hubSlug || !hub) return NextResponse.json({ error: 'hub inválido' }, { status: 400 });
  if (!isRoleAllowedForHub(String(sessionUser.role), hubSlug)) {
    return NextResponse.json({ error: 'Acesso negado para este hub' }, { status: 403 });
  }
  const hubKey = getAiHubKeyBySlug(hub.slug);
  if (!hubKey) return NextResponse.json({ error: 'hub inválido' }, { status: 400 });

  const deleted = await prisma.aiConversation.deleteMany({ where: { id, userId, hub: hubKey } });
  if (deleted.count === 0) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
