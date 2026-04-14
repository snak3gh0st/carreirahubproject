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

export function ConversationSidebar({ selectedId, onSelect, onNew }: { selectedId?: string; onSelect: (id: string) => void; onNew: () => void }) {
  const [data, setData] = useState<{ conversations: Conversation[] } | null>(null);
  const refresh = async () => {
    const res = await fetch('/api/dashboard/ai/conversations');
    if (res.ok) setData(await res.json());
  };
  useEffect(() => { refresh(); }, []);

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
                  <button
                    onClick={() => onSelect(c.id)}
                    className={`w-full text-left px-2 py-1.5 rounded text-sm truncate ${selectedId === c.id ? 'bg-muted font-medium' : 'hover:bg-muted/50'}`}
                  >
                    {c.title}
                  </button>
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
