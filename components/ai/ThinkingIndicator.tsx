'use client';

export function ThinkingIndicator({ label }: { label: string }) {
  const barHeights = [10, 16, 22, 16, 10];
  const delays = [0, 150, 300, 150, 0];

  return (
    <div className="mt-2 inline-flex flex-col gap-2 rounded-[20px] border border-black/5 bg-white px-4 py-3 shadow-[0_10px_30px_rgba(23,53,44,0.05)]">
      <div className="flex items-end gap-[3px]">
        {barHeights.map((height, i) => (
          <div
            key={i}
            style={{
              height: `${height}px`,
              animationDelay: `${delays[i]}ms`,
            }}
            className="w-[4px] origin-bottom rounded-full bg-primary/70 animate-pulse-bar"
          />
        ))}
      </div>
      <p className="text-[10px] italic text-muted-foreground">{label}</p>
    </div>
  );
}
