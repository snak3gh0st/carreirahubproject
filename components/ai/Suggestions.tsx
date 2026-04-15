'use client';
export function Suggestions({ items, onPick }: { items: string[]; onPick: (q: string) => void }) {
  if (!items.length) return null;
  return (
    <div className="mx-auto flex max-w-[960px] flex-wrap justify-center gap-3 px-6 py-6">
      {items.map(q => (
        <button key={q} onClick={() => onPick(q)}
          className="rounded-full border border-black/5 bg-white px-4 py-2 text-xs text-[#17352c] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#f5f8f5]">
          {q}
        </button>
      ))}
    </div>
  );
}
