'use client';
import { useState } from 'react';
import { MessageCircle, X, Maximize2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChatPanel } from './ChatPanel';

export function ChatBubble() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Hide bubble on /dashboard/ai — that page IS the full-screen chat
  if (pathname?.startsWith('/dashboard/ai')) return null;

  // Respect visibility flag (set NEXT_PUBLIC_AI_COPILOT_VISIBLE=false to hide)
  if (process.env.NEXT_PUBLIC_AI_COPILOT_VISIBLE === 'false') return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir CarreiraUSA AI"
          className="fixed bottom-4 right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition z-50"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}
      {open && (
        <div className="fixed bottom-4 right-4 w-[400px] h-[600px] max-h-[80vh] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-background shadow-2xl flex flex-col z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
            <div className="text-sm font-semibold">CarreiraUSA AI</div>
            <div className="flex items-center gap-1">
              <Link href="/dashboard/ai" aria-label="Abrir em tela cheia" className="p-1 hover:bg-muted rounded">
                <Maximize2 className="w-4 h-4" />
              </Link>
              <button onClick={() => setOpen(false)} aria-label="Fechar" className="p-1 hover:bg-muted rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ChatPanel />
          </div>
        </div>
      )}
    </>
  );
}
