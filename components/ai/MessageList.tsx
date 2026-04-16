'use client';
import { MessageBubble } from './MessageBubble';
import { ToolCallCard, resolveToolMeta } from './ToolCallCard';
import { ThinkingIndicator } from './ThinkingIndicator';
import { useEffect, useRef } from 'react';

// v6 message shape: { id, role, parts: [{type: 'text', text} | {type: 'tool-*', toolName, input, output}] }

function detectInFlightTool(messages: any[]): string | null {
  // Only inspect the last assistant message
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    const parts = m.parts ?? [];
    // Find the last tool part without output/result (in-flight)
    for (let j = parts.length - 1; j >= 0; j--) {
      const p = parts[j];
      const type = typeof p.type === 'string' ? p.type : '';
      const isTool = type.startsWith('tool-') || type === 'tool-invocation' || type === 'tool-call';
      if (!isTool) continue;
      const hasResult = p.output !== undefined || p.result !== undefined || p.state === 'result';
      if (!hasResult) {
        return p.toolName ?? type.replace(/^tool-/, '');
      }
    }
    break; // only check the last assistant message
  }
  return null;
}

export function MessageList({
  messages,
  isStreaming,
  onDeleteMessage,
  onRefreshPersona,
}: {
  messages: any[];
  isStreaming: boolean;
  onDeleteMessage?: (messageId: string) => void;
  onRefreshPersona?: (personaSlug: string) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isStreaming]);

  const inFlightTool = isStreaming ? detectInFlightTool(messages) : null;
  const loadingLabel = inFlightTool
    ? `Pesquisando ${resolveToolMeta(inFlightTool).label.toLowerCase()}...`
    : 'Escrevendo resposta...';

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
        {messages.map(m => {
          // v6: message has parts array
          const parts = m.parts ?? [{ type: 'text', text: typeof m.content === 'string' ? m.content : '' }];
          return (
            <div key={m.id}>
              {parts.map((p: any, idx: number) => {
                if (p.type === 'text' && p.text) {
                  return (
                    <MessageBubble
                      key={idx}
                      role={m.role === 'assistant' ? 'assistant' : 'user'}
                      content={p.text}
                      personaSlug={m.personaSlug}
                      fromCache={m.fromCache}
                      onDelete={onDeleteMessage ? () => onDeleteMessage(m.id) : undefined}
                      onRefreshPersona={onRefreshPersona}
                    />
                  );
                }
                if (typeof p.type === 'string' && p.type.startsWith('tool-')) {
                  return (
                    <ToolCallCard
                      key={idx}
                      toolName={p.toolName ?? p.type}
                      args={p.input ?? p.args}
                      result={p.output ?? p.result}
                    />
                  );
                }
                return null;
              })}
            </div>
          );
        })}
        {isStreaming && <ThinkingIndicator label={loadingLabel} />}
        <div ref={endRef} />
      </div>
    </div>
  );
}
