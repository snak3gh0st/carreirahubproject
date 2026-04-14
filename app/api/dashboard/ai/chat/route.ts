import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { streamText, stepCountIs, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { allowedToolsForRole } from '@/lib/ai/tools';
import { checkRateLimit } from '@/lib/ai/rate-limit';
import { buildSystemPrompt } from '@/lib/ai/prompts/system.pt-br';
import { currentDateInET, buildPageContext } from '@/lib/ai/prompts/context-builder';
import { prisma } from '@/lib/db';
import { logAiEvent } from '@/lib/ai/logger';
import { truncateJson } from '@/lib/ai/dto';
import type { AiToolDefinition } from '@/lib/ai/tools/_base';
import type { ToolContext } from '@/lib/ai/types';
import { AiMessageRole } from '@prisma/client';

export const maxDuration = 300; // Fluid Compute — covers slow QB/DocuSign

const RATE_LIMIT_PER_HOUR = Number(process.env.AI_RATE_LIMIT_PER_HOUR ?? 50);
const MAX_INPUT_CHARS = 4000;

function toAiSdkTool(def: AiToolDefinition<any, any>, ctx: ToolContext) {
  return tool({
    description: def.description,
    inputSchema: def.inputSchema,
    execute: async (args: any) => def.handler(args, ctx),
  });
}

export async function POST(req: NextRequest) {
  const started = Date.now();

  // 1. Kill switch (FIRST — must return 503 before any auth/DB work so a flipped env var
  //    immediately disables the feature for everyone, even unauthenticated probes).
  if (process.env.AI_COPILOT_ENABLED !== 'true') {
    return NextResponse.json({ error: 'AI copilot desativado', code: 'AI_DISABLED' }, { status: 503 });
  }

  // 2. Auth guard (NextAuth — per CLAUDE.md dashboard portal)
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id?: string; email?: string; name?: string | null; role?: any } | undefined;
  if (!session || !sessionUser?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = { id: sessionUser.id!, email: sessionUser.email ?? '', name: sessionUser.name ?? null, role: sessionUser.role };

  // 3. Parse body
  let body: { messages: any[]; conversationId?: string; pathname?: string; params?: Record<string, any> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const { messages, conversationId: bodyConvId, pathname = '/dashboard', params = {} } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages é obrigatório' }, { status: 400 });
  }
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  const userText = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : JSON.stringify(lastUserMsg?.content ?? '');
  if (userText.length > MAX_INPUT_CHARS) {
    return NextResponse.json({ error: `Mensagem muito longa (máximo ${MAX_INPUT_CHARS} caracteres)` }, { status: 400 });
  }

  // 4. Rate limit
  const rl = await checkRateLimit(user.id, RATE_LIMIT_PER_HOUR);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Limite de ${RATE_LIMIT_PER_HOUR} mensagens/hora atingido. Tente novamente em ${rl.retryAfterSec}s.`, retryAfterSec: rl.retryAfterSec, code: 'RATE_LIMITED' },
      { status: 429 }
    );
  }

  // 5. Conversation — create or load
  let conversation = bodyConvId
    ? await prisma.aiConversation.findFirst({ where: { id: bodyConvId, userId: user.id } })
    : null;
  if (!conversation) {
    conversation = await prisma.aiConversation.create({
      data: { userId: user.id, title: userText.slice(0, 80) },
    });
  }

  // 6. Persist USER message immediately (audit even if model fails)
  await prisma.aiMessage.create({
    data: {
      conversationId: conversation.id,
      role: AiMessageRole.USER,
      content: userText,
    },
  });

  // 7. Build tool context + filtered tools
  const ctx: ToolContext = {
    user: { id: user.id, email: user.email, name: user.name ?? null, role: user.role },
    conversationId: conversation.id,
    requestStartedAt: started,
  };
  const allowed = allowedToolsForRole(user.role);
  const aiSdkTools: Record<string, ReturnType<typeof toAiSdkTool>> = {};
  for (const t of allowed) {
    aiSdkTools[t.name] = toAiSdkTool(t, ctx);
  }

  // 8. Build system prompt with page context + tool list
  const systemPrompt = buildSystemPrompt({
    userName: user.name ?? user.email,
    userRole: String(user.role),
    currentDate: currentDateInET(),
    pageContext: buildPageContext(pathname, params),
    toolNames: allowed.map((t) => t.name),
  });

  const model = openai(process.env.AI_MODEL_DEFAULT ?? 'gpt-4o-mini');
  const modelId = process.env.AI_MODEL_DEFAULT ?? 'gpt-4o-mini';

  logAiEvent({ kind: 'request', userId: user.id, conversationId: conversation.id, model: modelId });

  // 9. streamText with onFinish persisting assistant + tool steps
  try {
    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools: aiSdkTools,
      stopWhen: stepCountIs(8),
      onFinish: async ({ usage, text, finishReason, steps }) => {
        const latencyMs = Date.now() - started;
        const tokensIn = (usage as any)?.promptTokens ?? (usage as any)?.inputTokens ?? 0;
        const tokensOut = (usage as any)?.completionTokens ?? (usage as any)?.outputTokens ?? 0;
        try {
          // Persist TOOL rows for each tool call across all steps
          for (const step of steps ?? []) {
            const toolCalls = (step as any).toolCalls ?? [];
            const toolResults = (step as any).toolResults ?? [];
            for (let i = 0; i < toolCalls.length; i++) {
              const tc = toolCalls[i];
              const tr = toolResults[i];
              await prisma.aiMessage.create({
                data: {
                  conversationId: conversation!.id,
                  role: AiMessageRole.TOOL,
                  content: '',
                  toolName: tc.toolName,
                  toolArgs: (tc.args ?? tc.input ?? {}) as any,
                  toolResult: truncateJson(tr?.result ?? tr?.output ?? null) as any,
                  modelUsed: modelId,
                },
              });
            }
          }
          // Persist ASSISTANT final message
          await prisma.aiMessage.create({
            data: {
              conversationId: conversation!.id,
              role: AiMessageRole.ASSISTANT,
              content: text ?? '',
              tokensIn,
              tokensOut,
              modelUsed: modelId,
              latencyMs,
            },
          });
          await prisma.aiConversation.update({
            where: { id: conversation!.id },
            data: { updatedAt: new Date() },
          });
          logAiEvent({ kind: 'finish', userId: user.id, conversationId: conversation!.id, model: modelId, tokensIn, tokensOut, latencyMs });
        } catch (err) {
          logAiEvent({ kind: 'error', userId: user.id, conversationId: conversation!.id, error: (err as Error).message });
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    const message = (err as Error).message;
    await prisma.aiMessage.create({
      data: {
        conversationId: conversation.id,
        role: AiMessageRole.ASSISTANT,
        content: '',
        errorMessage: message,
        modelUsed: modelId,
        latencyMs: Date.now() - started,
      },
    }).catch(() => {});
    logAiEvent({ kind: 'error', userId: user.id, conversationId: conversation.id, error: message });
    return NextResponse.json({ error: `Falha no copiloto: ${message}` }, { status: 500 });
  }
}
