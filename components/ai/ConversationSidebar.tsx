'use client';
import { useState, useEffect } from 'react';

interface Conversation { id: string; title: string; updatedAt: string; messageCount: number; }

function groupByDate(convs: Conversation[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const weekAgo = new Date(today.getTime() - 7 * 86_400_000);
  const groups: Record<string, Conversation[]> = { 'Hoje': [], 'Ontem': [], 'Esta semana': [], 'Mais antigas': [] };
  for (const c of convs) {
    const d = new Date(c.updatedAt);
    if (d >= today) groups['Hoje'].push(c);
    else if (d >= yesterday) groups['Ontem'].push(c);
    else if (d >= weekAgo) groups['Esta semana'].push(c);
    else groups['Mais antigas'].push(c);
  }
  return groups;
}

export function ConversationSidebar({
  hub,
  selectedId,
  onSelect,
  onNew,
}: {
  hub: string;
  selectedId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const [data, setData] = useState<{ conversations: Conversation[] } | null>(null);
  const refresh = async () => {
    const res = await fetch(`/api/dashboard/ai/conversations?hub=${hub}`);
    if (res.ok) setData(await res.json());
  };
  useEffect(() => { refresh(); }, [hub, selectedId]);

  const handleDelete = async (conversationId: string) => {
    const previous = data;
    setData((current) => ({
      conversations: (current?.conversations ?? []).filter((conversation) => conversation.id !== conversationId),
    }));

    try {
      const res = await fetch(`/api/dashboard/ai/conversations?id=${conversationId}&hub=${hub}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        setData(previous);
        return;
      }

      await refresh();
      if (selectedId === conversationId) {
        onNew();
      }
    } catch {
      setData(previous);
    }
  };

  const convs = data?.conversations ?? [];
  const groups = groupByDate(convs);

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col">
      <div className="p-3 border-b border-border">
        <button onClick={onNew} className="w-full rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium">
          + Nova conversa
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {Object.entries(groups).map(([label, items]) => items.length > 0 && (
          <div key={label} className="p-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 mb-1">{label}</div>
            <ul>
              {items.map(c => (
                <li key={c.id}>
                  <div className={`group flex items-center gap-1 rounded ${selectedId === c.id ? 'bg-muted' : 'hover:bg-muted/50'}`}>
                    <button
                      onClick={() => onSelect(c.id)}
                      className={`min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm ${selectedId === c.id ? 'font-medium' : ''}`}
                    >
                      {c.title}
                    </button>
                    <button
                      type="button"
                      aria-label={`Excluir conversa ${c.title}`}
                      onClick={() => {
                        if (window.confirm('Excluir esta conversa permanentemente?')) {
                          void handleDelete(c.id);
                        }
                      }}
                      className="mr-1 rounded px-2 py-1 text-xs text-muted-foreground opacity-70 transition hover:bg-background md:opacity-0 md:group-hover:opacity-100"
                    >
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {convs.length === 0 && <div className="p-4 text-xs text-muted-foreground">Nenhuma conversa ainda.</div>}
      </div>
    </aside>
  );
}
