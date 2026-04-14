'use client';
export function Suggestions({ items, onPick }: { items: string[]; onPick: (q: string) => void }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2 p-4">
      {items.map(q => (
        <button key={q} onClick={() => onPick(q)}
          className="text-xs rounded-full border border-border bg-card hover:bg-muted px-3 py-1.5">
          {q}
        </button>
      ))}
    </div>
  );
}
