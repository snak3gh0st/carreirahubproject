import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { streamText, stepCountIs, tool, convertToModelMessages } from 'ai';
import { openai } from '@ai-sdk/openai';
import { allowedToolsForRole, filterToolsByWhitelist } from '@/lib/ai/tools';
import { checkRateLimit } from '@/lib/ai/rate-limit';
import { buildSystemPrompt } from '@/lib/ai/prompts/system.pt-br';
import { currentDateInET, buildPageContext } from '@/lib/ai/prompts/context-builder';
import { prisma } from '@/lib/db';
import { logAiEvent } from '@/lib/ai/logger';
import { truncateJson } from '@/lib/ai/dto';
import { resolveDashboardAiModel } from '@/lib/ai/model-selection';
import type { AiToolDefinition } from '@/lib/ai/tools/_base';
import type { ToolContext } from '@/lib/ai/types';
import { AiMessageRole } from '@prisma/client';
import { getAiHubBySlug, getAiHubKeyBySlug, isRoleAllowedForHub } from '@/lib/ai/hub-config';
import { getPersonaBySlug, type PersonaDefinition } from '@/lib/ai/personas';

// Emit a cached string as a single-chunk AI SDK v6 UI message stream.
// The frame shape matches what `result.toUIMessageStreamResponse()` produces,
// so the browser client renderer treats it identically to a live model response.
function streamCachedResponse(text: string): Response {
  const encoder = new TextEncoder();
  const id = `cache-${Date.now()}`;
  const events = [
    `data: ${JSON.stringify({ type: "start", messageId: id })}\n\n`,
    `data: ${JSON.stringify({ type: "text-start", id })}\n\n`,
    `data: ${JSON.stringify({ type: "text-delta", id, delta: text })}\n\n`,
    `data: ${JSON.stringify({ type: "text-end", id })}\n\n`,
    `data: ${JSON.stringify({ type: "finish", messageId: id })}\n\n`,
    `data: [DONE]\n\n`,
  ];
  const stream = new ReadableStream({
    start(controller) {
      for (const e of events) controller.enqueue(encoder.encode(e));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "x-vercel-ai-ui-message-stream": "v1",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

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
  let body: {
    messages: any[];
    conversationId?: string;
    pathname?: string;
    params?: Record<string, any>;
    hub?: string;
    personaSlug?: string;
    refresh?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const { messages, conversationId: bodyConvId, pathname = '/dashboard', params = {} } = body;
  const hubSlug = body.hub;
  const hub = typeof hubSlug === 'string' ? getAiHubBySlug(hubSlug) : null;
  if (!hubSlug || !hub) {
    return NextResponse.json({ error: 'hub inválido' }, { status: 400 });
  }
  if (!isRoleAllowedForHub(String(user.role), hubSlug)) {
    return NextResponse.json({ error: 'Acesso negado para este hub' }, { status: 403 });
  }
  const hubKey = getAiHubKeyBySlug(hub.slug);
  if (!hubKey) {
    return NextResponse.json({ error: 'hub inválido' }, { status: 400 });
  }
  // Persona validation — only if flag is on and personaSlug is provided.
  // When the flag is off, personaSlug/refresh are silently ignored (feature-disabled no-op).
  // `persona` and `refresh` are consumed by T7-T9 (cache lookup, prompt injection, bypass).
  const personasEnabled = process.env.AI_PERSONAS_ENABLED === "true";
  const personaSlug = personasEnabled ? body.personaSlug : undefined;
  const refresh = personasEnabled ? Boolean(body.refresh) : false;
  let persona: PersonaDefinition | null = null;
  if (personaSlug) {
    persona = getPersonaBySlug(personaSlug);
    if (!persona) {
      return NextResponse.json({ error: "persona desconhecida" }, { status: 400 });
    }
    if (persona.hub !== hub.slug) {
      return NextResponse.json({ error: "persona não pertence a este hub" }, { status: 400 });
    }
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages é obrigatório' }, { status: 400 });
  }
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  // UI messages store text in `parts` (AI SDK v6), not `content`
  const userText = (() => {
    const textPart = lastUserMsg?.parts?.find((p: any) => p.type === 'text');
    if (textPart) return textPart.text as string;
    if (typeof lastUserMsg?.content === 'string') return lastUserMsg.content;
    return JSON.stringify(lastUserMsg?.content ?? '');
  })();
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
  let conversation = null;
  if (bodyConvId) {
    conversation = await prisma.aiConversation.findFirst({ where: { id: bodyConvId, userId: user.id, hub: hubKey } });
    if (!conversation) {
      return NextResponse.json({ error: 'Conversa não encontrada para este hub' }, { status: 404 });
    }
  } else {
    conversation = await prisma.aiConversation.create({
      data: { userId: user.id, title: userText.slice(0, 80), hub: hubKey },
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

  // 6b. Persona cache branching
  let cachedForDelta: string | null = null;
  if (persona) {
    const { computeDayBucket, lookupPersonaCache, recordPersonaCacheRead } = await import(
      "@/lib/ai/persona-cache"
    );
    const dayBucket = computeDayBucket(new Date(), persona.cacheTtlMinutes);

    if (!refresh) {
      const lookup = await lookupPersonaCache({
        personaSlug: persona.slug,
        dayBucket,
        userId: user.id,
      });

      if (lookup.status === "hit" && !lookup.alreadyRead) {
        // First read → serve cached content as a normal assistant message, no model call.
        // NOTE: this return intentionally bypasses the onFinish path below (no model
        // inference = no tool steps = no usage row). The ASSISTANT row is written inline.
        const cached = lookup.entry.content;
        if (!cached) {
          // Defensive: treat empty cache as miss and fall through to model generation.
          // A cached empty string should not happen but if it did, serving it would
          // render a blank bubble without fixing the underlying absence of content.
          cachedForDelta = null;
          // Intentionally no `recordPersonaCacheRead` — we want the next request to
          // retry the lookup-or-generate path, not to believe it has "been read".
        } else {
          await recordPersonaCacheRead({
            personaSlug: persona.slug,
            dayBucket,
            userId: user.id,
          });
          await prisma.aiMessage.create({
            data: {
              conversationId: conversation.id,
              role: AiMessageRole.ASSISTANT,
              content: cached,
              modelUsed: "cache",
              latencyMs: Date.now() - started,
              personaSlug: persona.slug,
              fromCache: true,
            },
          });
          await prisma.aiConversation.update({
            where: { id: conversation.id },
            data: { updatedAt: new Date() },
          });
          logAiEvent({
            kind: "finish",
            userId: user.id,
            conversationId: conversation.id,
            model: "cache",
            tokensIn: 0,
            tokensOut: 0,
            latencyMs: Date.now() - started,
          });
          return streamCachedResponse(cached);
        }
      }

      if (lookup.status === "hit" && lookup.alreadyRead) {
        // Repeat read → signal delta mode to later blocks (T8 uses this).
        cachedForDelta = lookup.entry.content;
      }
    }
  }

  // 7. Build tool context + filtered tools
  const ctx: ToolContext = {
    user: { id: user.id, email: user.email, name: user.name ?? null, role: user.role },
    conversationId: conversation.id,
    requestStartedAt: started,
  };
  const allowed = allowedToolsForRole(user.role);
  const effectiveTools = persona
    ? filterToolsByWhitelist(allowed, persona.toolWhitelist)
    : allowed;
  const aiSdkTools: Record<string, ReturnType<typeof toAiSdkTool>> = {};
  for (const t of effectiveTools) {
    aiSdkTools[t.name] = toAiSdkTool(t, ctx);
  }

  // 8. Build system prompt with page context + tool list
  const systemPrompt = buildSystemPrompt({
    userName: user.name ?? user.email,
    userRole: String(user.role),
    currentDate: currentDateInET(),
    pageContext: buildPageContext(pathname, params),
    toolNames: effectiveTools.map((t) => t.name),
    hub: {
      slug: hub.slug,
      label: hub.label,
      focus: hub.focus,
    },
  });

  // Persona: append persona-specific system rules. For delta mode, also prepend
  // the cached analysis as context the model must compare against.
  let effectiveSystemPrompt = systemPrompt;
  let effectiveUserPrompt: string | null = null;
  if (persona) {
    effectiveSystemPrompt = `${systemPrompt}\n\n---\n${persona.systemAppend}`;
    if (cachedForDelta) {
      effectiveSystemPrompt += `\n\n---\nANÁLISE ANTERIOR (cache da rodada em vigor, gerada mais cedo hoje):\n${cachedForDelta}`;
      effectiveUserPrompt = persona.deltaPrompt;
    } else {
      effectiveUserPrompt = persona.defaultPrompt;
    }
  }

  const modelId = resolveDashboardAiModel(process.env.AI_MODEL_DEFAULT);
  const model = openai(modelId);

  logAiEvent({ kind: 'request', userId: user.id, conversationId: conversation.id, model: modelId });

  // 9. streamText with onFinish persisting assistant + tool steps
  try {
    const recentMessages = messages.slice(-20);
    let modelMessages = await convertToModelMessages(recentMessages);
    if (persona && effectiveUserPrompt) {
      // Overwrite the last user turn with the persona's preset prompt so accidental
      // text in the composer can't override output format.
      modelMessages = [
        ...modelMessages.slice(0, -1),
        { role: "user", content: effectiveUserPrompt } as any,
      ];
    }
    const result = streamText({
      model,
      system: effectiveSystemPrompt,
      messages: modelMessages,
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
              personaSlug: persona?.slug ?? null,
              fromCache: false,
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
