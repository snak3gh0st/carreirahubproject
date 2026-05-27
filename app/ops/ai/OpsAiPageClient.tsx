"use client";

import { useState } from "react";
import { ChatPanel } from "@/components/ai/ChatPanel";

export function OpsAiPageClient() {
  const [conversationId, setConversationId] = useState<string | undefined>();

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-[1500px] flex-col px-4 pt-6 pb-4 md:h-dvh md:px-8 md:pt-8 md:pb-6">
      <header className="mb-4 shrink-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
          Operação
        </p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-gray-900 md:text-[32px]">
          Assistente AI
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-gray-600">
          Pergunte sobre alunos, fases, SLAs e checklists. Peça resumos e rascunhos de mensagens. O assistente vê a operação em tempo real.
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-200/60 bg-white">
        <ChatPanel
          hub="operational"
          conversationId={conversationId}
          onNewConversationId={setConversationId}
        />
      </div>
    </div>
  );
}
