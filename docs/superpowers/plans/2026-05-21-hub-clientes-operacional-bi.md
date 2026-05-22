# Hub Clientes Operacional e BI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidar as demandas da reunião de 21/05/2026 em melhorias seguras para Hub Clientes, separando dados internos do portal do aluno, organizando documentos/aplicações/entrevistas e automatizando métricas operacionais.

**Architecture:** Evoluir o Ops Hub existente em cima dos modelos `MentorshipEnrollment`, `OpsStudentProfile`, `OpsStudentDocument`, `OpsStudentActivity`, `MentorshipSession` e `OpsStudentComment`. Manter comunicação com cliente manual por padrão; automatizações devem gerar alertas internos, métricas e tarefas, não mensagens diretas ao aluno sem ação humana. Dados sensíveis entram com criptografia/mascara e o portal do aluno recebe apenas campos explicitamente públicos.

**Tech Stack:** Next.js App Router, React Query, Prisma/PostgreSQL, document storage service, NextAuth RBAC, OpenAI realtime/mock-interview, Recharts/BI operacional, node:test.

---

## Assessment das anotações

As anotações do Gemini estão úteis como ata operacional, mas precisam virar backlog técnico normalizado antes de implementação.

**Corretas / coerentes com o produto atual:**
- Acesso correto deve ser `app.carreira.com`; a URL com `/hub` leva ao portal do aluno.
- Mock Interview com IA e teste de inglês já existem e devem ganhar limites de uso.
- Comunicação automática com aluno deve ser evitada; alertas devem ser internos.
- Separar dados internos e externos é requisito central.
- BI operacional deve substituir planilhas manuais.
- Entrevistas, aplicações, entregáveis, sessões, NPS e recolocações são métricas que o Hub já tem base para capturar.

**Pontos duplicados ou que precisam ser fundidos:**
- "Separar campos documentos", "Adicionar Canva", "Adicionar material", "Permitir links upload" e "Permitir arquivos Word" pertencem ao mesmo épico de Documentos e Materiais.
- "Categorizar comentários", "Diferenciar mensagens", "Segmentar visualização", "Organizar campos" e "Remover comentários" pertencem ao épico de Privacidade/Visibilidade.
- "Editar status entrevista", "Migrar controle aplicação" e "Criar alarme no link" pertencem ao épico de Aplicações/Entrevistas.
- "Compartilhar planilha", "Enviar planilhas", "Documentar entregáveis" e "automatizar BI" pertencem ao épico de Métricas Operacionais.

**Riscos de ambiguidade:**
- "F tunes" não está claro; precisa de definição antes de virar tarefa.
- "Inserir formulários dos últimos 3 meses" depende dos arquivos/dados fonte e do mapeamento de templates.
- "Adicionar alunos solicitados por Fraenze" depende da lista de alunos e regra de atribuição.
- "Comunicar criptografia SSN" é mais produto/comunicação do que código; o código deve primeiro garantir criptografia/máscara.

## Current Code Map

**Modelos existentes relevantes:**
- `prisma/schema.prisma` — `Customer.ssn`, `MentorshipEnrollment`, `OpsStudentProfile`, `OpsStudentDocument`, `OpsStudentActivity`, `MentorshipSession`, `OpsStudentComment`.
- `lib/customers/sensitive-identification.ts` — sanitização de identificação sensível já aparece em worktree local.
- `app/api/ops/enrollments/[id]/route.ts` — carrega perfil completo e já sanitiza dados do cliente.
- `app/api/ops/enrollments/[id]/documents/route.ts` — upload operacional já aceita PDF, DOC, DOCX, TXT, JPG e PNG.
- `app/api/ops/enrollments/[id]/activities/route.ts` — base para aplicações, entrevistas, ofertas e recolocações.
- `app/api/ops/enrollments/[id]/comments/route.ts` — comentários internos ainda sem categoria/visibilidade.
- `app/ops/students/[enrollmentId]/OperationalHubSection.tsx` — tela principal para documentos, links, atividades e perfil operacional.
- `app/ops/bi/page.tsx` — BI operacional inicial por fase, risco, formulários e sessões.
- `lib/ops/workflow.ts` — fases, sessões e playbooks operacionais.
- `lib/hub/ai-mock-interview-access.ts`, `lib/hub/ai-mock-interview-usage-store.ts`, `lib/hub/realtime-english-test-usage-store.ts` — base para limites de IA.

## Priority 0: Correções antes de expandir

- [x] **P0.1 Corrigir vazamento/exibição incorreta de telefone**
  - Verificar `app/api/ops/enrollments/[id]/route.ts`, `app/api/customers/[id]/route.ts`, `app/api/customers/route.ts`, telas de cliente e queries que montam perfil.
  - Escrever teste cobrindo que um aluno nunca recebe telefone/email de outro perfil.
  - Rodar: `npx tsx --test tests/customer-sensitive-identification.test.ts`.
  - Critério de aceite: Ana Lima/Shelliga ou qualquer aluno retornam somente dados do próprio `customerId`.

- [x] **P0.2 Fechar SSN com criptografia/máscara real**
  - Confirmar se a alteração local em `lib/customers/sensitive-identification.ts` já cobre API interna e portal do aluno.
  - Se `Customer.ssn` ainda for texto puro, criar camada de criptografia no write/read e nunca retornar SSN completo nas APIs.
  - Critério de aceite: suporte e time técnico veem no máximo `***-**-1234`; comercial/jurídico só acessam conforme RBAC.

- [ ] **P0.3 Congelar mensagens automáticas ao aluno**
  - Auditar chamadas de email/WhatsApp/Digisac ligadas a renovação, material e fases.
  - Alterar automações novas para criar tarefa/alerta interno, não mensagem ao aluno.
  - Critério de aceite: alertas operacionais aparecem para equipe, mas nenhum envio externo ocorre sem ação manual.
  - Parcial implementado: atribuição/lembrete de formulários do Hub agora geram alerta interno manual-only em vez de disparo automático ao aluno.

## Priority 1: Documentos, materiais e links externos

- [x] **P1.1 Normalizar tipos de documento**
  - Atualizar `DOCUMENT_KINDS` em `OperationalHubSection.tsx` para separar `CV_ORIGINAL`, `CV_FINAL`, `COVER_LETTER_ORIGINAL`, `COVER_LETTER_FINAL`, `CANVA_LINK`, `STUDENT_MATERIAL`, `SUPPORT_MATERIAL`, `CONTRACT_PDF`, `FORM_PDF`, `OTHER`.
  - Ajustar validações no backend para tipos controlados.
  - Critério de aceite: currículo e cover letter aparecem em campos separados.

- [x] **P1.2 Aceitar link além de arquivo**
  - Evoluir `OpsStudentDocument` ou criar `OpsStudentResource` com campos `resourceType`, `url`, `visibility`.
  - Permitir Canva/LinkedIn/Board/Notion como links validados.
  - Critério de aceite: time pode salvar link de Canva sem anexar PDF.

- [x] **P1.3 Remover comentários do fluxo técnico de documentos**
  - Separar `notes` técnicas de documento das mensagens/comentários de relacionamento.
  - Restringir papel técnico para anexar material e mudar status, sem enviar mensagem ao aluno.
  - Critério de aceite: time técnico não vê CTA de comentário ao cliente no bloco de documentos.

## Priority 2: Privacidade e segmentação interno vs aluno

- [x] **P2.1 Adicionar visibilidade explícita**
  - Em comentários, documentos, atividades e campos de perfil, usar `visibility = INTERNAL | STUDENT_VISIBLE`.
  - Criar helpers centralizados para impedir retorno acidental de campos internos no `/hub`.
  - Critério de aceite: portal do aluno só exibe dados com visibilidade pública.

- [x] **P2.2 Categorizar comentários internos**
  - Evoluir `OpsStudentComment` com `category = COMERCIAL | FINANCEIRO | SUPORTE | ESCRITA | TECNICO | JURIDICO`.
  - Adicionar filtro e cores na UI.
  - Critério de aceite: comentários internos podem ser filtrados por grupo e continuam invisíveis ao aluno.

- [x] **P2.3 Diferenciar visualmente campos internos e externos**
  - Criar legenda visual discreta em Ops Hub: interno, visível ao aluno, sensível.
  - Aplicar a documentos, perfil, comentários e materiais.
  - Critério de aceite: operador sabe antes de salvar se o campo aparece no portal.

## Priority 2.5: Card do aluno e prévia do portal

- [x] **P2.5.1 Reorganizar o card/perfil do aluno**
  - Redesenhar `app/ops/students/[enrollmentId]/StudentProfileClient.tsx` para ficar mais denso, escaneável e operacional.
  - Estrutura recomendada:
    - Header fixo com nome, fase, responsável, programa, risco, renovação e CTAs principais.
    - Resumo operacional em 4 blocos: Jornada, Documentos, Aplicações/Entrevistas, Financeiro/Contrato.
    - Separação visual clara entre "Interno", "Visível ao aluno" e "Sensível".
    - Timeline compacta de fases, sessões, entregáveis e atividades recentes.
    - Alertas de ação: formulário pendente, material em revisão, entrevista sem status, aplicação sem link, renovação próxima.
  - Critério de aceite: operação entende em menos de 30 segundos fase atual, próximos passos, pendências, materiais e o que o aluno consegue ver.

- [x] **P2.5.2 Criar botão "Ver portal do aluno"**
  - Adicionar CTA no header do perfil operacional.
  - Preferir rota interna de preview, por exemplo `/ops/students/[enrollmentId]/portal-preview`, em vez de impersonar login real do aluno.
  - A preview deve reutilizar a mesma lógica/dados do portal do aluno e renderizar com banner fixo: "Prévia interna - visão do aluno".
  - Bloquear qualquer ação destrutiva ou envio externo dentro da preview.
  - Critério de aceite: time operacional consegue conferir exatamente o que aparece ao aluno sem receber cookie/token do aluno e sem alterar dados.

- [x] **P2.5.3 Criar checklist visual de publicação**
  - Mostrar no card quais itens estão públicos: material final, link Canva, formulários, contrato, invoices, resultado de inglês.
  - Mostrar quais itens são internos: comentários, notas técnicas, status operacional, métricas internas, alertas.
  - Critério de aceite: antes de publicar material/comentário, a equipe consegue validar se será ou não visível no portal.

## Priority 3: Aplicações, entrevistas e recolocações

- [x] **P3.1 Migrar controle de aplicações do Notion**
  - Usar `OpsStudentActivity` como base ou criar `OpsJobApplication`.
  - Campos obrigatórios: cargo, empresa, salário, link da vaga, status, data, indústria.
  - Bloquear criação sem link para tipo `APPLICATION`.
  - Critério de aceite: não é possível registrar aplicação sem link.

- [x] **P3.2 Editar status de entrevista**
  - Status sugeridos: `EM_PROCESSO`, `PASSOU`, `NAO_PASSOU`, `NO_SHOW`, `REMARCADO`, `CANCELADO`.
  - Permitir update em atividades de entrevista.
  - Critério de aceite: Roberta/Fraenze conseguem marcar candidato como "não passou".

- [x] **P3.3 Recolocação por indústria/cargo**
  - Capturar `industry`, `roleTitle`, `company`, `salary`, `placementDate`.
  - Alimentar BI de recolocação.
  - Critério de aceite: BI mostra recolocações por indústria e cargo.

## Priority 4: Fases, agenda e renovação

- [x] **P4.1 Reverter status/fase do aluno**
  - Criar rota segura para mover `MentorshipEnrollment.currentPhaseId` para fase anterior, mantendo `PhaseTransition`.
  - Exigir motivo textual.
  - Critério de aceite: histórico mostra quem moveu, de qual fase e por quê.

- [x] **P4.2 Renomear fase Material**
  - Alterar seed/label de `material` para "Em processo de revisão", preservando `key`.
  - Critério de aceite: UI mostra novo nome sem quebrar relatórios por `phaseKey`.

- [x] **P4.3 Renovação automática com ajuste manual**
  - Definir `renewalDate = contratação + 185 dias`.
  - Adicionar extensão manual por pausa/situação pessoal com motivo.
  - Critério de aceite: prazo final recalcula e histórico preserva alterações.

- [x] **P4.4 Status de treinamentos**
  - Em `MentorshipSession`, adicionar status: `REALIZADO`, `NO_SHOW`, `REMARCADO`.
  - Exibir contador de remarcações/no-shows.
  - Critério de aceite: agenda/BI mostram sessões por status.

## Priority 5: Formulários e atribuições

- [ ] **P5.1 Inserir formulários dos últimos 3 meses**
  - Depende de arquivo fonte de Fraenze/Roberta.
  - Mapear templates: entrada, 3 meses, 6 meses, NPS sessão.
  - Criar script idempotente de importação.
  - Critério de aceite: formulários aparecem no histórico correto sem duplicar submissões.

- [ ] **P5.2 Adicionar alunos solicitados por Fraenze**
  - Depende da lista de alunos.
  - Usar bulk enrollment existente se possível.
  - Critério de aceite: alunos entram com responsável, programa, fase inicial e dados mínimos.

- [x] **P5.3 Configurar senioridade**
  - Adicionar `seniority = ENTRY_LEVEL | MID_LEVEL | SENIOR | DIRECTOR` em perfil operacional/cliente.
  - Mostrar na sessão bússola e no resumo de IA.
  - Critério de aceite: senioridade fica disponível em perfil e filtros.

- [x] **P5.4 Criar botão de reenviar acesso do Hub**
  - Adicionar ação manual no perfil operacional do aluno.
  - Criar/renovar token de definição de senha do `ClientUser`, desbloqueando a conta quando necessário.
  - Enviar link do portal apenas após clique do operacional.
  - Critério de aceite: operação consegue reenviar acesso sem impersonar aluno e sem automação externa involuntária.

## Priority 6: IA, limites e resumos

- [x] **P6.1 Limitar uso de IA**
  - Consolidar regras em `ai-mock-interview-access` e stores de uso.
  - Regra inicial: 2 sessões liberadas por aluno; sessões extras exigem crédito/override interno.
  - Critério de aceite: aluno não inicia 3ª sessão sem permissão.

- [x] **P6.2 Melhorar resumo analítico do aluno**
  - Montar contexto com entrevistas, aplicações, documentos finais, sessões, comentários internos permitidos para IA interna, NPS e formulário.
  - Aumentar prompt para resposta executiva detalhada.
  - Critério de aceite: pergunta como "quantas entrevistas Roberta realizou?" responde com número, fonte e recorte.
  - Implementado também: painel de IA interna no perfil operacional do aluno para perguntas livres com contexto do aluno selecionado.

- [x] **P6.3 Regras do teste de inglês**
  - Se não passou, bloquear avanço automático para onboarding e criar fila de análise manual.
  - Critério de aceite: resultado insuficiente aparece no card e exige decisão interna.

## Priority 7: BI operacional e automação de métricas

- [x] **P7.1 Métricas mínimas automáticas**
  - Mock interviews por mês.
  - Sessões 1-on-1 por responsável.
  - No-shows/remarcações.
  - Materiais entregues: CV, cover letter, resumos, outros.
  - NPS por sessão/formulário.
  - Recolocações por indústria/cargo.
  - Critério de aceite: `/ops/bi` substitui contagem manual principal.

- [x] **P7.2 Redesenhar BI com KPIs e gráficos executivos**
  - Evoluir `app/ops/bi/page.tsx` de painel operacional básico para dashboard visual de gestão.
  - KPIs principais:
    - Alunos ativos, pausados, concluídos e em risco.
    - Alunos por fase/área.
    - SLA médio por fase e quantidade fora do prazo.
    - Sessões realizadas no mês, semana e por responsável.
    - Taxa de no-show e remarcação.
    - Mock interviews realizadas e pendentes.
    - Materiais entregues por tipo: CV, cover letter, resumo, Canva/material externo.
    - Aplicações registradas, entrevistas em processo, entrevistas perdidas e ofertas.
    - Recolocações por mês, indústria e cargo.
    - NPS médio por etapa/sessão.
    - Pendências críticas: formulário pendente, material sem revisão, entrevista sem status, aplicação sem link, renovação próxima.
  - Gráficos recomendados:
    - Linha: evolução mensal de sessões, mock interviews e recolocações.
    - Barras horizontais: alunos por fase com risco/SLA.
    - Barras empilhadas: entregáveis por tipo e por responsável.
    - Donut: distribuição de status de entrevistas/aplicações.
    - Heatmap simples: carga de trabalho por responsável x fase.
    - Ranking: top alunos em risco e top gargalos operacionais.
  - Visual/design:
    - Dashboard denso, escaneável e orientado a ação.
    - Evitar visual de marketing; usar layout de operação/gestão.
    - Cada gráfico deve ter CTA para lista filtrada de alunos.
    - Usar cores consistentes: verde para em dia, âmbar para atenção, vermelho para risco, azul para produção, roxo somente para IA/mock.
  - Critério de aceite: liderança consegue abrir `/ops/bi` e responder rapidamente: onde está o gargalo, quem está sobrecarregado, quantos entregáveis saíram, quantos alunos avançaram e quais alunos precisam de ação.
  - Implementado também: pendências críticas por categoria, entregáveis por responsável, mocks concluídos/criados e recolocações por indústria.

- [x] **P7.3 Criar camada de agregação de BI**
  - Criar serviço dedicado, por exemplo `lib/ops/ops-bi.ts`, para não deixar toda a lógica dentro da página.
  - Agregar dados de:
    - `MentorshipEnrollment`
    - `MentorshipSession`
    - `OpsStudentDocument`
    - `OpsStudentActivity`
    - `PhaseChecklistProgress`
    - `FormAssignment` / `FormSubmission`
    - `AiMockInterviewSession`
    - `OpsStudentProfile`
  - Expor estrutura serializável para cards e gráficos.
  - Critério de aceite: `app/ops/bi/page.tsx` fica majoritariamente responsável por renderização, não por cálculo.

- [x] **P7.4 Criar componentes visuais de BI**
  - Criar componentes em `components/ops/bi/`:
    - `OpsKpiCard.tsx`
    - `OpsTrendChart.tsx`
    - `OpsPhaseBarChart.tsx`
    - `OpsWorkloadHeatmap.tsx`
    - `OpsStatusDonut.tsx`
    - `OpsRiskTable.tsx`
  - Usar Recharts para linha, barras e donut.
  - Usar tabela/lista para risco e gargalos, com links para o perfil do aluno.
  - Critério de aceite: gráficos são responsivos, legíveis em desktop e sem texto cortado.

- [ ] **P7.5 Importar planilhas de cálculo atuais**
  - Depende de Roberta enviar planilha e documento de métricas.
  - Mapear cada coluna para campo do banco.
  - Criar relatório de divergências entre planilha e Hub.
  - Critério de aceite: time entende quais métricas já vêm do sistema e quais ainda dependem de importação.

- [x] **P7.6 Alertas internos de prazo**
  - Gerar alertas para entregáveis críticos e atrasos por SLA.
  - Não enviar mensagem ao aluno.
  - Critério de aceite: operação recebe lembrete interno antes do prazo.

## Dependencies from team

- Fraenze: link de acesso/sistema de referência, alunos a adicionar, registros atualizados e regras de comunicação manual.
- Roberta: planilhas de cálculo, controle de entregáveis, lista de prazos de escrita e documento formal de métricas.
- Grupo: definição de "F tunes".

## Verification

- Unit tests targeted:
  - `npx tsx --test tests/customer-sensitive-identification.test.ts`
  - `npx tsx --test tests/hub/ai-mock-interview.test.ts`
  - criar novos testes para comentários, documentos, aplicações e BI.
- Build:
  - `npm run build`
- UAT:
  - Perfil operacional de aluno com documentos/link Canva.
  - Portal do aluno sem comentários internos.
  - Aplicação sem link bloqueada.
  - Entrevista marcada como "não passou".
  - BI com sessões, entregáveis, NPS e mock interviews.

## Recommended delivery order

1. P0 segurança/correções críticas.
2. P1/P2 documentos e privacidade, porque reduzem risco operacional imediato.
3. P3/P4 aplicações, entrevistas, fases e agenda.
4. P5 importações após receber dados.
5. P6 IA e limites.
6. P7 BI consolidado após dados estruturados.
