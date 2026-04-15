'use client';

type AiWorkspaceHeaderProps = {
  title: string;
  description: string;
};

export function AiWorkspaceHeader({ title, description }: AiWorkspaceHeaderProps) {
  return (
    <header className="border-b border-border bg-background px-6 py-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </header>
  );
}
