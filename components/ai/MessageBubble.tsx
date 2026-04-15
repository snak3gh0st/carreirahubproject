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
    <div className={`group mb-4 flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div className={`rounded-[24px] px-5 py-4 text-sm shadow-[0_10px_30px_rgba(23,53,44,0.05)] ${isUser ? 'max-w-[min(720px,92%)] bg-primary text-primary-foreground' : 'w-full max-w-[1040px] border border-black/5 bg-white'}`}>
        {isUser ? (
          <p className="whitespace-pre-wrap leading-7">{content}</p>
        ) : (
          <div className="prose prose-sm max-w-none prose-headings:mb-3 prose-headings:mt-6 prose-headings:font-semibold prose-p:leading-7 prose-p:text-[#24342d] prose-li:my-1 prose-strong:text-[#10251e] dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
        {!isUser && content && (
          <div className="mt-3 flex items-center gap-2">
            <button onClick={copy} className="flex items-center gap-1 text-xs text-muted-foreground transition opacity-70 hover:opacity-100 md:opacity-0 md:group-hover:opacity-100">
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Copiado' : 'Copiar'}
            </button>
            {onDelete && (
              <button onClick={handleDelete} className="flex items-center gap-1 text-xs text-muted-foreground transition opacity-70 hover:text-destructive hover:opacity-100 md:opacity-0 md:group-hover:opacity-100">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
      {isUser && onDelete && (
        <button onClick={handleDelete} className="mt-1 mr-1 flex items-center gap-1 text-xs text-muted-foreground transition opacity-70 hover:text-destructive hover:opacity-100 md:opacity-0 md:group-hover:opacity-100">
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
