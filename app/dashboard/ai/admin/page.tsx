'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface UsageData {
  today: { messages: number; tokensIn: number; tokensOut: number; estimatedCostUSD: number };
  last30d: { messages: number; tokensIn: number; tokensOut: number; estimatedCostUSD: number };
  topUsers: { userId: string; email: string; name: string | null; role: string | null; conversations: number }[];
  topTools: { toolName: string | null; calls: number }[];
  recentErrors: { id: string; conversationId: string; errorMessage: string; toolName: string | null; modelUsed: string | null; createdAt: string }[];
}

export default function AiAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<UsageData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user || (session.user as any).role !== 'ADMIN') { router.replace('/dashboard'); return; }
    fetch('/api/dashboard/ai/admin/usage')
      .then(async r => r.ok ? setData(await r.json()) : setErr(`HTTP ${r.status}`))
      .catch(e => setErr(e.message));
  }, [session, status, router]);

  if (err) return <div className="p-6 text-destructive">Erro: {err}</div>;
  if (!data) return <div className="p-6 text-muted-foreground">Carregando...</div>;

  const fmtUsd = (n: number) => `US$ ${n.toFixed(4)}`;
  const fmtInt = (n: number) => new Intl.NumberFormat('pt-BR').format(n);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">CarreiraUSA AI &mdash; Uso &amp; Custo</h1>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card label="Mensagens hoje" value={fmtInt(data.today.messages)} />
        <Card label="Custo hoje" value={fmtUsd(data.today.estimatedCostUSD)} />
        <Card label="Mensagens 30d" value={fmtInt(data.last30d.messages)} />
        <Card label="Custo 30d" value={fmtUsd(data.last30d.estimatedCostUSD)} />
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">Top 10 usuários (30d)</h2>
        <Table rows={data.topUsers.map(u => [u.email, u.role ?? '-', String(u.conversations)])} headers={['Usuário', 'Role', 'Conversas']} />
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">Top 10 tools (30d)</h2>
        <Table rows={data.topTools.map(t => [t.toolName ?? '(sem nome)', String(t.calls)])} headers={['Tool', 'Chamadas']} />
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">Erros recentes (30d)</h2>
        <Table rows={data.recentErrors.map(e => [e.createdAt.slice(0, 19).replace('T', ' '), e.toolName ?? '-', e.errorMessage.slice(0, 80)])} headers={['Quando', 'Tool', 'Erro']} />
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs">
          <tr>{headers.map(h => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} className="px-3 py-4 text-xs text-muted-foreground text-center">Sem dados</td></tr>
          ) : rows.map((r, i) => (
            <tr key={i} className="border-t border-border">{r.map((cell, j) => <td key={j} className="px-3 py-2">{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
