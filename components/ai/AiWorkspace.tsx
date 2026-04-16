'use client';

import { useState } from 'react';
import type { AiHubDefinition } from '@/lib/ai/hub-config';
import { ConversationSidebar } from './ConversationSidebar';
import { ChatPanel } from './ChatPanel';
import { AiWorkspaceHeader } from './AiWorkspaceHeader';

type AiWorkspaceProps = {
  hub: AiHubDefinition;
};

export function AiWorkspace({ hub }: AiWorkspaceProps) {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <AiWorkspaceHeader title={hub.label} description={hub.focus} />
      <div className="flex min-h-0 flex-1">
        <ConversationSidebar
          hub={hub.slug}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
          onNew={() => setSelectedId(undefined)}
        />
        <main className="min-w-0 flex-1">
          <ChatPanel hub={hub.slug} conversationId={selectedId} onNewConversationId={setSelectedId} />
        </main>
      </div>
    </div>
  );
}
