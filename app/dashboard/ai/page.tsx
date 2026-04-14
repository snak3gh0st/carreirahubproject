'use client';
import { useState } from 'react';
import { ConversationSidebar } from '@/components/ai/ConversationSidebar';
import { ChatPanel } from '@/components/ai/ChatPanel';

export default function AiPage() {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  // Changing selectedId forces ChatPanel remount so it loads that conversation
  return (
    <div className="flex h-full">
      <ConversationSidebar
        selectedId={selectedId}
        onSelect={(id) => setSelectedId(id)}
        onNew={() => setSelectedId(undefined)}
      />
      <main className="flex-1 min-w-0">
        <ChatPanel key={selectedId ?? 'new'} conversationId={selectedId} />
      </main>
    </div>
  );
}
