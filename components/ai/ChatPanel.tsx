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

export function ChatPanel({
  conversationId,
  onNewConversationId,
}: {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { messages, sendMessage, status, setMessages } = useChat({ transport } as any);

  // Load existing conversation messages when conversationId changes
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    fetch(`/api/dashboard/ai/conversations/${conversationId}`)
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
  }, [conversationId, setMessages]);

  const firstName = session?.user?.name?.split(' ')[0] ?? 'time';
  const role = (session?.user as any)?.role ?? 'ADMIN';
  const isStreaming = status === 'streaming' || status === 'submitted';

  const extraBody = { conversationId, pathname, params };

  const handleSend = (text: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sendMessage as any)({ text }, { body: extraBody });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col justify-center">
          <div className="text-center px-6">
            <h2 className="text-lg font-semibold">Oi, {firstName}! Como posso ajudar?</h2>
            <p className="text-sm text-muted-foreground mt-1">Pergunte sobre alunos, leads, faturas, contratos.</p>
          </div>
          <Suggestions
            items={getSuggestionsForRole(role)}
            onPick={(q) => (sendMessage as any)({ text: q }, { body: extraBody })}
          />
        </div>
      ) : (
        <MessageList messages={messages} isStreaming={isStreaming} />
      )}
      <Composer onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
