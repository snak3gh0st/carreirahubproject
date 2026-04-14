'use client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Trash2 } from 'lucide-react';
import { useState } from 'react';

export function MessageBubble({
  role,
  content,
  onDelete,
}: {
  role: 'user' | 'assistant';
  content: string;
  onDelete?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const handleDelete = () => {
    if (window.confirm('Remover esta mensagem?')) {
      onDelete?.();
    }
  };
  const isUser = role === 'user';
  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-3 group`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${isUser ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'}`}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
        {!isUser && content && (
          <div className="flex items-center gap-2 mt-1">
            <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition text-xs flex items-center gap-1 text-muted-foreground">
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Copiado' : 'Copiar'}
            </button>
            {onDelete && (
              <button onClick={handleDelete} className="opacity-0 group-hover:opacity-100 transition text-xs flex items-center gap-1 text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
      {isUser && onDelete && (
        <button onClick={handleDelete} className="opacity-0 group-hover:opacity-100 transition text-xs flex items-center gap-1 text-muted-foreground hover:text-destructive mt-1 mr-1">
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
