# Design: Hub Operacional — "Minhas Tarefas"

**Data:** 2026-04-27
**Status:** Aprovado pelo usuário
**Objetivo:** Substituir o Clickup como ferramenta operacional da equipe de suporte da Carreira USA

---

## Contexto

A equipe de suporte (3 pessoas) usa o Clickup hoje para:
- Ver os alunos na fase sob sua responsabilidade
- Seguir um checklist de tarefas por fase
- Registrar sessões e progresso

Cada membro da equipe é responsável por uma ou mais fases. Todos os alunos passam pelas mesmas 11 fases (Bastão → Renovação). O checklist de cada fase é o mesmo para todos os alunos, independente do programa (PASS ou CAREER).

**Fluxo do usuário hoje no Clickup:**
1. Abre a ferramenta → vê os alunos na sua fase
2. Clica em um aluno → vê e marca o checklist da fase
3. Registra sessões manualmente

---

## O Que Será Construído

### 1. Página "Minhas Tarefas" (`/ops/my-tasks`)

Nova entrada no sidebar do hub operacional. Visão personalizada por membro da equipe logado.

**Topo da página:**
- Nome da fase atribuída ao usuário (ex: "Fase: Bastão")
- 4 métricas: Total de alunos na fase / Checklists incompletos / Precisam atenção / Em dia

**Fila de alunos (coluna esquerda):**
- Lista de alunos na fase do usuário, ordenados por prioridade (mais urgentes no topo)
- Cada card mostra: nome, data de início, número de sessões, progresso do checklist (X/N tarefas), barra de progresso colorida
- Alertas visuais: vermelho (sem sessão 14+ dias), amarelo (sem sessão 7+ dias)

**Painel de checklist (coluna direita):**
- Abre ao clicar num aluno da fila
- Exibe o checklist completo da fase com cada tarefa tagueada por tipo: Sessão, Formulário, WhatsApp, Documento
- Itens concluídos mostram a data de conclusão
- Última tarefa ("Avançar de fase") só aparece como disponível quando todos os anteriores estão marcados

**Registro rápido de sessão:**
- Campo de texto no painel do aluno
- Ao registrar, marca automaticamente o item de sessão correspondente no checklist

---

### 2. Checklist Engine (modelo de dados)

**Checklist templates por fase** — armazenados em código (similar ao padrão `FORM_TEMPLATES`):

```typescript
// lib/ops/phase-checklists.ts
export const PHASE_CHECKLISTS: Record<string, ChecklistItem[]> = {
  "bastao": [
    { key: "welcome_whatsapp", label: "Boas-vindas enviada por WhatsApp", type: "whatsapp" },
    { key: "onboarding_form_assigned", label: "Formulário de Onboarding atribuído", type: "form" },
    { key: "onboarding_form_completed", label: "Formulário de Onboarding respondido", type: "form", autoComplete: true },
    { key: "session_1", label: "1ª Sessão realizada", type: "session", autoComplete: true },
    { key: "session_2", label: "2ª Sessão realizada", type: "session", autoComplete: true },
    { key: "summary_whatsapp", label: "Resumo da fase enviado ao aluno", type: "whatsapp" },
    { key: "vision_doc", label: "Documento de Visão revisado e aprovado", type: "doc" },
    { key: "advance_phase", label: "Aluno avançado para próxima fase", type: "advance", requiresAll: true },
  ],
  // demais fases...
}
```

**Progresso por aluno** — tabela `PhaseChecklistProgress` no banco:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | cuid | PK |
| `enrollmentId` | String | FK → MentorshipEnrollment |
| `phaseKey` | String | Ex: "bastao" |
| `itemKey` | String | Ex: "session_1" |
| `completedAt` | DateTime? | null = pendente |
| `completedById` | String? | FK → User |

**Auto-completar:** Quando uma sessão é registrada (`MentorshipSession`), o sistema marca automaticamente o item de sessão correspondente. Quando um formulário é respondido, marca o item de formulário.

---

### 3. Atribuição de Fase por Membro

Novo campo `assignedPhases` no modelo `User` (array de phase keys):

```prisma
model User {
  // ... campos existentes
  assignedPhases String[] // ex: ["bastao", "ancora"]
}
```

Gerenciado pela tela de Coordenador (já existente em `/ops/coordinator`).

---

### 4. Sidebar atualizado (`/ops`)

Nova entrada "Minhas Tarefas" com badge mostrando quantos alunos têm checklists incompletos.

Reorganização das seções:
- **Principal:** Dashboard, Pipeline, Ações do Dia
- **Meu Trabalho:** Minhas Tarefas *(novo)*, Alunos, Matricular
- **Comunicação:** Formulários, NPS & Satisfação *(futuro)*
- **Gestão:** Coordenador, Guia

---

## APIs Necessárias

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/ops/my-tasks` | Retorna alunos na fase do usuário com progresso |
| `POST` | `/api/ops/my-tasks/[enrollmentId]/checklist` | Marca/desmarca item do checklist |
| `GET` | `/api/ops/phase-checklists` | Retorna templates de checklist por fase |

---

## Migração de Dados

Nenhuma migração de dados existente necessária. O sistema começa com todos os checklists em branco. A equipe preenche retroativamente conforme trabalha, ou começa do zero com alunos novos.

---

## O Que Fica Para Depois (fora do escopo agora)

- Sessões: página de agendamento dedicada (`/ops/sessions`)
- NPS & Satisfação: dashboard de scores
- WhatsApp: feed de mensagens integrado
- Relatórios: exportação de progresso por fase

---

## Critérios de Sucesso

1. Membro da equipe abre "Minhas Tarefas" e vê exatamente os alunos da sua fase
2. Consegue marcar itens do checklist sem sair da página
3. Registrar uma sessão automaticamente atualiza o checklist
4. Coordenador consegue atribuir fases aos membros pela tela existente
