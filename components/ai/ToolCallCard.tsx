'use client';
import { useState } from 'react';
import {
  ChevronRight, Wrench, DollarSign, Users, GraduationCap,
  FileText, Search, Info, LayoutDashboard, Loader2, CheckCircle2
} from 'lucide-react';

type ToolMeta = { label: string; Icon: React.ComponentType<{ className?: string }> };

const TOOL_META: Record<string, ToolMeta> = {
  getQuickBooksReport:    { label: 'QuickBooks',          Icon: DollarSign },
  getOverdueInvoices:     { label: 'Faturas vencidas',    Icon: DollarSign },
  getLeadsByStatus:       { label: 'Leads',               Icon: Users },
  getLeadsBySource:       { label: 'Leads',               Icon: Users },
  getLeadQualification:   { label: 'Leads',               Icon: Users },
  getStudentsByPhase:     { label: 'Alunos',              Icon: GraduationCap },
  getStudentProfile:      { label: 'Aluno',               Icon: GraduationCap },
  getStudentSessions:     { label: 'Sessões do aluno',    Icon: GraduationCap },
  getStudentNextActions:  { label: 'Próximas ações',      Icon: GraduationCap },
  getContracts:           { label: 'Contratos',           Icon: FileText },
  getDocumentStatus:      { label: 'Contratos',           Icon: FileText },
  getCoordinatorOverview: { label: 'Visão operacional',   Icon: LayoutDashboard },
  getDailyActionView:     { label: 'Visão do dia',        Icon: LayoutDashboard },
  searchStudents:         { label: 'Busca de alunos',     Icon: Search },
  searchCustomers:        { label: 'Busca de clientes',   Icon: Search },
  getProcessGuide:        { label: 'Documentação',        Icon: Info },
  explainDataModel:       { label: 'Documentação',        Icon: Info },
  listCapabilities:       { label: 'Capacidades',         Icon: Info },
};

function resolveToolMeta(toolName: string): ToolMeta {
  // toolName can come as 'getQuickBooksReport' or 'tool-getQuickBooksReport'
  const clean = toolName.replace(/^tool-/, '');
  return TOOL_META[clean] ?? { label: clean, Icon: Wrench };
}

export function ToolCallCard({
  toolName, args, result,
}: { toolName: string; args?: unknown; result?: unknown }) {
  const [open, setOpen] = useState(false);
  const { label, Icon } = resolveToolMeta(toolName);
  const inFlight = result === undefined;
  const clean = toolName.replace(/^tool-/, '');

  return (
    <div className="my-3 rounded-[22px] border border-black/5 bg-white text-xs shadow-[0_10px_30px_rgba(23,53,44,0.06)]">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#f5f8f5]"
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <div className="flex flex-col min-w-0 flex-1">
          <span className="truncate font-medium text-[#17352c]">{label}</span>
          <span className="font-mono text-[10px] text-muted-foreground truncate">{clean}</span>
        </div>
        {inFlight ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground flex-shrink-0" />
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] text-green-600 dark:text-green-500 flex-shrink-0">
            <CheckCircle2 className="w-3 h-3" />
            Concluído
          </span>
        )}
        <ChevronRight className={`w-3 h-3 ml-1 transition flex-shrink-0 ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-border px-4 py-3">
          <div>
            <div className="mb-1 text-muted-foreground">Argumentos:</div>
            <pre className="whitespace-pre-wrap rounded-xl bg-[#f7faf7] p-3">{JSON.stringify(args ?? {}, null, 2)}</pre>
          </div>
          {result !== undefined && (
            <div>
              <div className="mb-1 text-muted-foreground">Resultado:</div>
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-xl bg-[#f7faf7] p-3">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Export metadata for reuse by MessageList
export { TOOL_META, resolveToolMeta };
