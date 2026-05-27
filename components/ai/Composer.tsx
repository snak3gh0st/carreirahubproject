'use client';
import { Send } from 'lucide-react';
import { useState, useRef, KeyboardEvent } from 'react';

const MAX_CHARS = 4000;

export function Composer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void | Promise<void>;
  disabled: boolean;
}) {
  const [value, setValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const send = async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || sendingRef.current) return;
    sendingRef.current = true;
    setIsSending(true);
    try {
      await onSend(trimmed);
      setValue('');
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
  };
  const isDisabled = disabled || isSending;
  return (
    <div className="border-t border-border p-3 bg-card">
      <div className="flex gap-2 items-end">
        <textarea
          ref={ref}
          value={value}
          onChange={e => setValue(e.target.value.slice(0, MAX_CHARS))}
          onKeyDown={onKeyDown}
          placeholder="Pergunte algo ao CarreiraUSA AI..."
          rows={1}
          className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary max-h-32"
          disabled={isDisabled}
        />
        <button onClick={() => void send()} disabled={isDisabled || !value.trim()} className="rounded-lg bg-primary text-primary-foreground p-2 disabled:opacity-50">
          <Send className="w-4 h-4" />
        </button>
      </div>
      <div className="text-[10px] text-muted-foreground text-right mt-1">{value.length}/{MAX_CHARS}</div>
    </div>
  );
}
