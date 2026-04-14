'use client';
import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

const STORAGE_KEY = 'carreirausa-ai-compliance-accepted-v1';

export function ComplianceGate({ children }: { children: React.ReactNode }) {
  const [accepted, setAccepted] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    try {
      setAccepted(sessionStorage.getItem(STORAGE_KEY) === 'true');
    } catch {
      setAccepted(false);
    }
  }, []);

  if (accepted === null) return null; // avoid flash

  if (!accepted) {
    return (
      <div className="flex flex-col h-full bg-background items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-5 h-5 text-brand-verde" />
            <h3 className="text-base font-semibold">Termo de Compromisso — CarreiraUSA AI</h3>
          </div>
          <div className="text-sm text-muted-foreground space-y-2 mb-4">
            <p>Este copiloto é de <strong>uso exclusivo interno</strong> da equipe CarreiraUSA.</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Não compartilhe informações confidenciais de alunos/clientes além do necessário para sua tarefa.</li>
              <li>Respostas do AI podem conter erros — confirme dados sensíveis antes de agir.</li>
              <li>Todas as mensagens são registradas para auditoria.</li>
              <li>Não use o AI para gerar conteúdo que viole políticas internas ou LGPD.</li>
            </ul>
            <p>Ao continuar, você aceita estes termos e se responsabiliza pelo uso.</p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                try { sessionStorage.setItem(STORAGE_KEY, 'true'); } catch { /* ignore */ }
                setAccepted(true);
              }}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              Aceitar e continuar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
