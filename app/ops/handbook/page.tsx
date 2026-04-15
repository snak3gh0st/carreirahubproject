import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OPS_WORKFLOW_DEFINITIONS } from "@/lib/ops/workflow";

function SectionLabel({ label, description }: { label: string; description: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm text-gray-600 mt-1">{description}</p>
    </div>
  );
}

export default async function OpsHandbookPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/ops/login");

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-brand-verde">Guia Operacional</h1>
        <p className="text-gray-500 text-sm mt-1">
          Passo a passo oficial para acompanhar clientes PASS e ADVANCED em cada fase da mentoria
          (Passagem de Bastão → Renovação). Esta página consolida os pontos do Slack, ClickUp e
          automações que o time precisa registrar diariamente.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          {
            label: "Entrada",
            description:
              "Venda no grupo 'Passagem de Bastão', cadastro no ClickUp, liberação do portal e mensagem inicial com manual e instruções.",
          },
          {
            label: "Teste de Inglês",
            description:
              "Marcar com Mônica/Leka, registrar no Slack english-test e na ficha do cliente (data, aplicador, resultado).",
          },
          {
            label: "Onboarding",
            description:
              "Parabens ao aluno aprovado, marcar onboarding, coletar board e Notion, confirmar compartilhamento e avisar o time.",
          },
          {
            label: "Ongoing",
            description:
              "Enviar material, criar pasta no Drive, liberar grupo, marcar 15 minutos com Rafael e acompanhar mock/treinamentos.",
          },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-gray-200 bg-white p-4">
            <SectionLabel label={item.label} description={item.description} />
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {OPS_WORKFLOW_DEFINITIONS.map((definition) => (
          <div key={definition.key} className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Fase</p>
                <h2 className="text-lg font-display font-semibold text-brand-verde">{definition.label}</h2>
                <p className="text-sm text-gray-500 mt-1">{definition.description}</p>
              </div>
              <div className="text-right text-xs text-gray-400">
                <p>Responsável: {definition.primaryOwner}</p>
                <p>Apoio: {definition.supportOwner}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Checklist</p>
                <div className="mt-2 space-y-2 text-sm text-gray-700">
                  {definition.checklist.map((item) => (
                    <p key={item}>• {item}</p>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Próximas Ações</p>
                <div className="mt-2 space-y-2 text-sm text-gray-700">
                  {definition.nextActions.map((item) => (
                    <p key={item}>→ {item}</p>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Registro Obrigatório</p>
                <div className="mt-2 space-y-2 text-sm text-gray-700">
                  {definition.requiredRecords.map((item) => (
                    <p key={item}>■ {item}</p>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Comunicação obrigatória</p>
                <div className="mt-2 space-y-2 text-sm text-gray-700">
                  {definition.communication.map((item) => (
                    <p key={item}>• {item}</p>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Automações sugeridas</p>
                <div className="mt-2 space-y-2 text-sm text-gray-700">
                  {definition.automations.map((item) => (
                    <p key={item}>• {item}</p>
                  ))}
                </div>
              </div>
            </div>

            {definition.slackChannels.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Slack obrigatório</p>
                <div className="mt-2 space-y-2 text-sm text-gray-700">
                  {definition.slackChannels.map((channel) => (
                    <p key={channel.name}>
                      {channel.name}: {channel.purpose}
                    </p>
                  ))}
                </div>
              </div>
            )}

          </div>
        ))}
      </div>
    </div>
  );
}
