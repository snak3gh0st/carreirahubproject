'use client';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useSession } from 'next-auth/react';
import { usePathname, useParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { MessageList } from './MessageList';
import { Composer } from './Composer';
import { Suggestions } from './Suggestions';
import { getSuggestionsForRole } from '@/lib/ai/suggestions-by-role';
import { ComplianceGate } from './ComplianceGate';
import { getPersonasForHub, type PersonaDefinition } from "@/lib/ai/personas";
import { PersonaCard } from "./PersonaCard";
import { PersonaChip } from "./PersonaChip";

export function ChatPanel({
  hub,
  conversationId,
  onNewConversationId,
}: {
  hub: string;
  conversationId?: string;
  onNewConversationId?: (id: string) => void;
}) {
  const { data: session } = useSession();
  const pathname = usePathname() ?? '/dashboard';
  const params = useParams() as Record<string, any>;

  // AI SDK v6: api endpoint must be passed via DefaultChatTransport, not as a top-level prop.
  // body is passed per-sendMessage so conversationId/pathname stay current.
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/dashboard/ai/chat' }),
    []
  );
  const { messages, sendMessage, status, setMessages } = useChat({ transport } as any);

  // Load existing conversation messages when conversationId changes
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    fetch(`/api/dashboard/ai/conversations/${conversationId}?hub=${hub}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.messages) return;
        // Map persisted DB messages to UI message shape
        const uiMessages = data.messages
          .filter((m: any) => m.role === 'USER' || m.role === 'ASSISTANT')
          .map((m: any) => ({
            id: m.id,
            role: m.role === 'USER' ? 'user' : 'assistant',
            parts: [{ type: 'text', text: m.content ?? '' }],
          }));
        setMessages(uiMessages);
      })
      .catch(() => null);
  }, [conversationId, hub, setMessages]);

  const firstName = session?.user?.name?.split(' ')[0] ?? 'time';
  const role = (session?.user as any)?.role ?? 'ADMIN';
  const isStreaming = status === 'streaming' || status === 'submitted';

  const extraBody = { conversationId, pathname, params, hub };

  const ensureConversationId = async (text: string) => {
    if (conversationId) {
      return conversationId;
    }

    const res = await fetch('/api/dashboard/ai/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hub, title: text.slice(0, 80) }),
    });
    if (!res.ok) {
      throw new Error('Falha ao criar conversa');
    }

    const data = await res.json();
    const newConversationId = data?.conversation?.id as string | undefined;
    if (!newConversationId) {
      throw new Error('Conversa criada sem id');
    }

    onNewConversationId?.(newConversationId);
    return newConversationId;
  };

  const handleSend = async (text: string) => {
    const resolvedConversationId = await ensureConversationId(text);
    (sendMessage as any)({ text }, { body: { ...extraBody, conversationId: resolvedConversationId } });
  };

  const personasEnabled = process.env.NEXT_PUBLIC_AI_PERSONAS_ENABLED === "true";
  const personas: PersonaDefinition[] = personasEnabled ? getPersonasForHub(hub as any) : [];

  const handleRunPersona = async (persona: PersonaDefinition, refresh = false) => {
    const prompt = persona.defaultPrompt;
    const resolvedConversationId = await ensureConversationId(prompt);
    (sendMessage as any)(
      { text: prompt },
      {
        body: {
          ...extraBody,
          conversationId: resolvedConversationId,
          personaSlug: persona.slug,
          refresh,
        },
      }
    );
  };

  const handleDeleteMessage = async (messageId: string) => {
    // Optimistic remove from UI
    const previousMessages = messages;
    setMessages((prev: any[]) => prev.filter((m: any) => m.id !== messageId));
    try {
      const res = await fetch(`/api/dashboard/ai/messages/${messageId}`, { method: 'DELETE' });
      if (!res.ok) {
        console.error('Failed to delete AI message', await res.text());
        setMessages(previousMessages as any);
      }
    } catch (err) {
      console.error('Delete error', err);
      setMessages(previousMessages as any);
    }
  };

  return (
    <ComplianceGate>
      <div className="flex flex-col h-full bg-background">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center gap-6 px-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold">Oi, {firstName}! Como posso ajudar?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Pergunte sobre alunos, leads, faturas, contratos.
              </p>
            </div>
            {personas.length > 0 && (
              <div className="flex flex-col items-center gap-3">
                {personas.map((p) => (
                  <PersonaCard
                    key={p.slug}
                    persona={p}
                    onRun={() => void handleRunPersona(p)}
                    disabled={isStreaming}
                  />
                ))}
              </div>
            )}
            <Suggestions
              items={getSuggestionsForRole(role, hub)}
              onPick={(q) => void handleSend(q)}
            />
          </div>
        ) : (
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            onDeleteMessage={handleDeleteMessage}
          />
        )}
        {messages.length > 0 && personas.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-black/5 px-4 py-2 md:px-8">
            {personas.map((p) => (
              <PersonaChip
                key={p.slug}
                persona={p}
                onRun={() => void handleRunPersona(p)}
                disabled={isStreaming}
              />
            ))}
          </div>
        )}
        <Composer onSend={handleSend} disabled={isStreaming} />
      </div>
    </ComplianceGate>
  );
}
