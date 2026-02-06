---
phase: quick
plan: 039
type: execute
wave: 1
depends_on: []
files_modified:
  - "app/dashboard/**/*.tsx"
  - "app/auth/**/*.tsx"
  - "app/payment/**/*.tsx"
  - "components/**/*.tsx"
autonomous: true

must_haves:
  truths:
    - "All user-facing text in the webapp displays in Portuguese (PT-BR)"
    - "No English labels, buttons, headers, placeholders, error messages, or tooltips remain in the UI"
    - "Code logic, variable names, function names, and comments remain unchanged"
  artifacts:
    - path: "app/dashboard/"
      provides: "All dashboard pages with PT-BR strings"
    - path: "components/"
      provides: "All components with PT-BR strings"
  key_links: []
---

<objective>
Translate all user-facing strings in the webapp from English to Portuguese (PT-BR).

Purpose: The app serves Carreira U.S.A., a Brazilian-focused business. All UI text should be in Portuguese.
Output: Every page and component displays PT-BR text. No English remains in user-facing strings.
</objective>

<execution_context>
@/Users/pauloloureiro/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pauloloureiro/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Translate dashboard pages (app/dashboard/)</name>
  <files>
    app/dashboard/page.tsx
    app/dashboard/layout.tsx
    app/dashboard/error.tsx
    app/dashboard/customers/**/*.tsx
    app/dashboard/leads/**/*.tsx
    app/dashboard/deals/**/*.tsx
    app/dashboard/invoices/**/*.tsx
    app/dashboard/payments/**/*.tsx
    app/dashboard/contracts/**/*.tsx
    app/dashboard/conversations/**/*.tsx
    app/dashboard/workflows/**/*.tsx
    app/dashboard/integrations/**/*.tsx
    app/dashboard/settings/**/*.tsx
    app/dashboard/insights/**/*.tsx
    app/dashboard/analytics/**/*.tsx
    app/dashboard/debug/**/*.tsx
    app/dashboard/webhooks/**/*.tsx
    app/auth/signin/page.tsx
    app/payment/**/page.tsx
  </files>
  <action>
Open each .tsx file in app/dashboard/ (and app/auth/, app/payment/) and translate ALL user-facing strings to PT-BR:

- Page titles/headers (e.g., "Customers" -> "Clientes", "Leads" -> "Leads", "Deals" -> "Negocios", "Invoices" -> "Faturas")
- Button labels (e.g., "Save" -> "Salvar", "Cancel" -> "Cancelar", "Delete" -> "Excluir", "Edit" -> "Editar", "New" -> "Novo/Nova", "Back" -> "Voltar", "Submit" -> "Enviar")
- Table column headers (e.g., "Name" -> "Nome", "Email" -> "Email", "Status" -> "Status", "Date" -> "Data", "Amount" -> "Valor", "Actions" -> "Acoes")
- Placeholders (e.g., "Search..." -> "Buscar...", "Enter name" -> "Digite o nome")
- Empty states (e.g., "No results found" -> "Nenhum resultado encontrado")
- Error messages (e.g., "Something went wrong" -> "Algo deu errado")
- Confirmation dialogs (e.g., "Are you sure?" -> "Tem certeza?")
- Toast/notification messages
- Form labels and helper text
- Loading text (e.g., "Loading..." -> "Carregando...")
- Tooltip text
- Navigation items in sidebar/layout

Common translations reference:
- Dashboard -> Painel
- Overview -> Visao Geral
- Settings -> Configuracoes
- Integrations -> Integracoes
- Analytics -> Analiticos
- Insights -> Insights
- Contracts -> Contratos
- Payments -> Pagamentos
- Conversations -> Conversas
- Workflows -> Fluxos de Trabalho
- Created/Updated -> Criado/Atualizado
- Active/Inactive -> Ativo/Inativo
- Pending/Approved/Rejected -> Pendente/Aprovado/Rejeitado
- Overdue -> Vencido/Atrasado
- Paid/Unpaid -> Pago/Nao Pago
- Total/Subtotal -> Total/Subtotal
- Description -> Descricao
- Phone -> Telefone
- Address -> Endereco
- Notes -> Observacoes
- Source -> Origem
- Score -> Pontuacao
- Qualification -> Qualificacao
- Details -> Detalhes
- History -> Historico
- Timeline -> Linha do Tempo
- Export -> Exportar
- Import -> Importar
- Filter -> Filtrar
- Sort -> Ordenar
- Refresh -> Atualizar
- Sync -> Sincronizar
- Connect/Disconnect -> Conectar/Desconectar
- Sign in/Sign out -> Entrar/Sair
- Success -> Sucesso
- Error -> Erro
- Warning -> Aviso

DO NOT change:
- Variable names, function names, component names
- CSS classes or Tailwind classes
- Import statements
- API routes or fetch URLs
- Enum values used in code logic
- console.log messages
- Code comments (leave as-is)
  </action>
  <verify>Run `npm run build` to confirm no TypeScript/compilation errors. Grep for common English phrases that should have been translated: `grep -r "Loading\.\.\." app/dashboard/ --include="*.tsx" | grep -v "//\|console\|import"` should return no results.</verify>
  <done>All dashboard pages, auth pages, and payment pages display PT-BR text. No English user-facing strings remain.</done>
</task>

<task type="auto">
  <name>Task 2: Translate shared components (components/)</name>
  <files>
    components/dashboard/**/*.tsx
    components/analytics/**/*.tsx
    components/invoices/**/*.tsx
    components/customers/**/*.tsx
    components/tables/**/*.tsx
    components/search/**/*.tsx
    components/ui/empty-state.tsx
    components/ui/pagination.tsx
    components/ui/stat-card.tsx
    components/ui/copy-button.tsx
    components/ui/form-field.tsx
    components/ui/status-indicator.tsx
    components/ui/currency-input.tsx
    components/ui/progress-bar.tsx
    components/webhook-stats-card.tsx
    components/skip-to-content.tsx
  </files>
  <action>
Open each component file and translate ALL user-facing strings to PT-BR.

Focus areas:
- components/dashboard/: Sidebar nav items, header text, user menu items
- components/analytics/: Chart labels, legends, axis labels, tooltips, empty states
- components/invoices/: Status labels, action buttons, timeline text, approval text
- components/customers/: Delete confirmation dialogs, button labels
- components/tables/: Pagination text ("Showing X of Y", "Previous", "Next"), bulk action labels, column headers
- components/search/: Search placeholder text
- components/ui/: Generic labels in empty-state, pagination, stat-card, copy-button, form-field, status-indicator

Use the same translation reference as Task 1.

DO NOT change:
- Variable names, function names, component names, props
- CSS/Tailwind classes
- Import statements
- shadcn/ui base components (button.tsx, input.tsx, dialog.tsx etc. that have no user-facing strings)
- Code comments
  </action>
  <verify>Run `npm run build` to confirm no errors. Visually check a few key components by searching for remaining English: `grep -rn '"Previous"\|"Next"\|"Loading"\|"No results"\|"Delete"\|"Are you sure"' components/ --include="*.tsx" | grep -v "//\|console\|import"` should return no results.</verify>
  <done>All shared components display PT-BR text. Pagination, empty states, action buttons, analytics labels all in Portuguese.</done>
</task>

</tasks>

<verification>
1. `npm run build` completes without errors
2. Spot-check key pages in browser: dashboard home, customers list, leads list, invoices, payments
3. No English user-facing strings visible in the UI
</verification>

<success_criteria>
- Every user-facing string across all ~130 .tsx files is in Portuguese (PT-BR)
- Build passes with no errors
- No variable names, function names, or code logic was altered
</success_criteria>

<output>
After completion, create `.planning/quick/039-translate-webapp-to-pt-br/039-SUMMARY.md`
</output>
