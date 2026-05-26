"use client";

import { useState } from "react";
import { ChatPanel } from "@/components/ai/ChatPanel";

export function OpsAiPageClient() {
  const [conversationId, setConversationId] = useState<string | undefined>();

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col md:h-screen">
      <ChatPanel
        hub="operational"
        conversationId={conversationId}
        onNewConversationId={setConversationId}
      />
    </div>
  );
}
