'use client';
import { useState } from 'react';
import { ChevronRight, Wrench } from 'lucide-react';

export function ToolCallCard({ toolName, args, result }: { toolName: string; args?: unknown; result?: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-2 text-xs border border-border rounded-lg bg-muted/30">
      <button onClick={() => setOpen(v => !v)} className="w-full px-3 py-2 flex items-center gap-2 hover:bg-muted/50">
        <Wrench className="w-3 h-3" />
        <span className="font-mono">{toolName}</span>
        <ChevronRight className={`w-3 h-3 ml-auto transition ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-3 py-2 border-t border-border space-y-2">
          <div>
            <div className="text-muted-foreground mb-1">Argumentos:</div>
            <pre className="whitespace-pre-wrap bg-background p-2 rounded">{JSON.stringify(args ?? {}, null, 2)}</pre>
          </div>
          {result !== undefined && (
            <div>
              <div className="text-muted-foreground mb-1">Resultado:</div>
              <pre className="whitespace-pre-wrap bg-background p-2 rounded max-h-60 overflow-auto">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
