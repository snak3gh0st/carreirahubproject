'use client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

export function MessageBubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3 group`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${isUser ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'}`}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
        {!isUser && content && (
          <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition text-xs mt-1 flex items-center gap-1 text-muted-foreground">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Copiado' : 'Copiar'}
          </button>
        )}
      </div>
    </div>
  );
}
