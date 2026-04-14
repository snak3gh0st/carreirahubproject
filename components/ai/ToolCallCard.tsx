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
    <div className="my-2 text-xs border border-border rounded-lg bg-muted/30">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-muted/50 text-left"
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-medium truncate">{label}</span>
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

// Export metadata for reuse by MessageList
export { TOOL_META, resolveToolMeta };
