'use client';
import { MessageBubble } from './MessageBubble';
import { ToolCallCard } from './ToolCallCard';
import { useEffect, useRef } from 'react';

// v6 message shape: { id, role, parts: [{type: 'text', text} | {type: 'tool-*', toolName, input, output}] }
export function MessageList({ messages, isStreaming }: { messages: any[]; isStreaming: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isStreaming]);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {messages.map(m => {
        // v6: message has parts array
        const parts = m.parts ?? [{ type: 'text', text: typeof m.content === 'string' ? m.content : '' }];
        return (
          <div key={m.id}>
            {parts.map((p: any, idx: number) => {
              if (p.type === 'text' && p.text) {
                return <MessageBubble key={idx} role={m.role === 'assistant' ? 'assistant' : 'user'} content={p.text} />;
              }
              if (typeof p.type === 'string' && p.type.startsWith('tool-')) {
                return <ToolCallCard key={idx} toolName={p.toolName ?? p.type} args={p.input ?? p.args} result={p.output ?? p.result} />;
              }
              return null;
            })}
          </div>
        );
      })}
      {isStreaming && <div className="text-xs text-muted-foreground italic">Pensando...</div>}
      <div ref={endRef} />
    </div>
  );
}
