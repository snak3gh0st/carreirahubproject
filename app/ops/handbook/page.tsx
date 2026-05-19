import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OPS_WORKFLOW_DEFINITIONS } from "@/lib/ops/workflow";
import {
  CheckSquare, ArrowRight, ClipboardList, MessageCircle,
  Zap, Hash, User, Users,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type SectionConfig = {
  icon: React.ElementType;
  label: string;
  accent: string;       // border-l color
  badge: string;        // badge bg+text
  iconColor: string;    // icon color
};

const SECTIONS: Record<string, SectionConfig> = {
  checklist:    { icon: CheckSquare,    label: "Checklist",              accent: "border-brand-verde",       badge: "bg-emerald-50 text-emerald-700",   iconColor: "text-brand-verde" },
  nextActions:  { icon: ArrowRight,     label: "Próximas Ações",         accent: "border-brand-tangerina",   badge: "bg-orange-50 text-orange-700",    iconColor: "text-brand-tangerina" },
  records:      { icon: ClipboardList,  label: "Registro Obrigatório",   accent: "border-blue-400",          badge: "bg-blue-50 text-blue-700",        iconColor: "text-blue-500" },
  communication:{ icon: MessageCircle,  label: "Comunicação",            accent: "border-violet-400",        badge: "bg-violet-50 text-violet-700",    iconColor: "text-violet-500" },
  automations:  { icon: Zap,           label: "Automações Sugeridas",   accent: "border-amber-400",         badge: "bg-amber-50 text-amber-700",      iconColor: "text-amber-500" },
  slack:        { icon: Hash,           label: "Slack Obrigatório",      accent: "border-green-500",         badge: "bg-green-50 text-green-700",      iconColor: "text-green-600" },
};

function SectionBlock({
  type, items,
}: {
  type: keyof typeof SECTIONS;
  items: string[] | Array<{ name: string; purpose: string }>;
}) {
  const cfg = SECTIONS[type];
  const Icon = cfg.icon;
  if (!items.length) return null;

  return (
    <div className={`border-l-2 ${cfg.accent} pl-3`}>
      <div className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-2 ${cfg.badge}`}>
        <Icon className={`h-3 w-3 ${cfg.iconColor}`} />
        {cfg.label}
      </div>
      <div className="space-y-1">
        {(items as (string | { name: string; purpose: string })[]).map((item, i) => (
          <p key={i} className="text-sm text-gray-600 leading-snug">
            {typeof item === "string" ? item : (
              <><span className="font-semibold text-gray-800">#{item.name}</span> — {item.purpose}</>
            )}
          </p>
        ))}
      </div>
    </div>
  );
}

const PROCESS_STEPS = [
  {
    label: "Entrada",
    description: "Venda no grupo 'Passagem de Bastão', cadastro no Hub, liberação do portal e mensagem inicial.",
    dot: "bg-brand-verde",
  },
  {
    label: "Teste de Inglês",
    description: "Marcar com Mônica/Leka, registrar no Slack english-test e na ficha do cliente.",
    dot: "bg-brand-tangerina",
  },
  {
    label: "Onboarding",
    description: "Parabenizar aprovado, marcar onboarding, coletar board e Notion, avisar o time.",
    dot: "bg-violet-500",
  },
  {
    label: "Ongoing",
    description: "Enviar material, criar pasta no Drive, liberar grupo, marcar 15 min com Rafael.",
    dot: "bg-blue-500",
  },
];

export default async function OpsHandbookPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/ops/login");

  return (
    <div className="p-6 md:p-8">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <ClipboardList className="h-7 w-7 text-brand-verde" />
          <h1 className="text-3xl font-display font-bold text-brand-verde tracking-tight">
            Guia Operacional
          </h1>
        </div>
        <p className="text-gray-500 text-sm max-w-2xl">
          Playbook oficial de Passagem de Bastão → Renovação. Consolida checklists, comunicações obrigatórias e automações para cada fase da mentoria.
        </p>
      </div>

      {/* ── Process Overview ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        {PROCESS_STEPS.map((step, idx) => (
          <div key={step.label} className="relative bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className={`h-1.5 w-full ${step.dot}`} />
            <div className="p-4">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Etapa {idx + 1}
              </span>
              <p className="font-display font-bold text-gray-900 text-sm mt-0.5">{step.label}</p>
              <p className="text-[11px] text-gray-400 mt-1 leading-snug">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Phase Timeline ───────────────────────────────────────────────── */}
      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
          Jornada completa · {OPS_WORKFLOW_DEFINITIONS.length} fases
        </p>
        <div className="flex flex-wrap gap-2">
          {OPS_WORKFLOW_DEFINITIONS.map((def, idx) => (
            <a key={def.key} href={`#phase-${def.key}`} className="flex items-center gap-1.5 bg-white border border-gray-200 hover:border-brand-verde/50 rounded-full px-3 py-1 text-xs font-semibold text-gray-600 hover:text-brand-verde transition-colors cursor-pointer">
              <span className="w-4 h-4 rounded-full bg-brand-verde/10 text-brand-verde text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                {idx + 1}
              </span>
              {def.shortLabel}
            </a>
          ))}
        </div>
      </div>

      {/* ── Phase Cards ──────────────────────────────────────────────────── */}
      <div className="space-y-5">
        {OPS_WORKFLOW_DEFINITIONS.map((def, idx) => (
          <div
            key={def.key}
            id={`phase-${def.key}`}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            {/* Phase header */}
            <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-50">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-verde/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-brand-verde font-display font-bold text-sm">{idx + 1}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Fase</span>
                  <h2 className="font-display font-bold text-gray-900 text-xl leading-tight">{def.label}</h2>
                  <p className="text-sm text-gray-500 mt-1 max-w-xl">{def.description}</p>
                </div>
              </div>
              <div className="flex-shrink-0 text-right hidden md:block">
                <div className="inline-flex items-center gap-1.5 text-xs bg-brand-verde/5 border border-brand-verde/20 rounded-lg px-2.5 py-1.5 mb-1.5">
                  <User className="h-3 w-3 text-brand-verde" />
                  <span className="text-brand-verde font-semibold">{def.primaryOwner}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
                  <Users className="h-3 w-3 text-gray-400" />
                  <span className="text-gray-500">{def.supportOwner}</span>
                </div>
              </div>
            </div>

            {/* Phase body — 2 rows, equal cols */}
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-50">
              {/* Col 1: Checklist */}
              <div className="p-5">
                <SectionBlock type="checklist" items={def.checklist} />
              </div>
              {/* Col 2: Próximas Ações + Slack */}
              <div className="p-5 space-y-5">
                <SectionBlock type="nextActions" items={def.nextActions} />
                {def.slackChannels.length > 0 && (
                  <SectionBlock type="slack" items={def.slackChannels} />
                )}
              </div>
              {/* Col 3: Registro + Comunicação + Automações */}
              <div className="p-5 space-y-5">
                <SectionBlock type="records"        items={def.requiredRecords} />
                <SectionBlock type="communication"  items={def.communication} />
                <SectionBlock type="automations"    items={def.automations} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
