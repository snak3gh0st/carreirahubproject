---
phase: quick-47
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - prisma/schema.prisma
  - lib/services/lead.service.ts
  - app/api/leads/route.ts
  - app/dashboard/leads/page.tsx
autonomous: true
requirements: [QUICK-47]

must_haves:
  truths:
    - "Um vendedor (SALES) que acessa /dashboard/leads vê apenas os leads que ele próprio criou"
    - "Um ADMIN ou SDR vê todos os leads (sem filtro por usuário)"
    - "Ao criar um lead manualmente, o campo createdById é preenchido com o ID do usuário autenticado"
    - "O pipeline de contagens (Novos, Qualificando, etc.) reflete apenas os leads visíveis ao usuário"
  artifacts:
    - path: "prisma/schema.prisma"
      provides: "Campo createdById opcional no model Lead"
      contains: "createdById"
    - path: "lib/services/lead.service.ts"
      provides: "Suporte a createdById no CreateLeadData e listLeads"
    - path: "app/api/leads/route.ts"
      provides: "POST salva createdById da sessão; GET filtra por userId se SALES"
    - path: "app/dashboard/leads/page.tsx"
      provides: "Consulta filtrada por userId para SALES; sem filtro para ADMIN/SDR"
  key_links:
    - from: "app/api/leads/route.ts"
      to: "prisma.lead.create"
      via: "createdById do getServerSession"
      pattern: "createdById.*session"
    - from: "app/dashboard/leads/page.tsx"
      to: "prisma.lead.findMany"
      via: "where.createdById para SALES"
      pattern: "createdById.*userId"
---

<objective>
Filtrar leads por vendedor: cada usuário com role SALES vê somente os leads que ele adicionou. ADMIN e SDR continuam vendo todos os leads.

Purpose: Privacidade e organização — vendedores não devem ver leads uns dos outros.
Output: Schema atualizado com createdById, API e page filtrando corretamente por role.
</objective>

<execution_context>
@/Users/pauloloureiro/.claude/get-shit-done/workflows/execute-plan.md
@/Users/pauloloureiro/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@prisma/schema.prisma
@lib/services/lead.service.ts
@app/api/leads/route.ts
@app/dashboard/leads/page.tsx
@app/dashboard/leads/new/LeadForm.tsx
@lib/auth.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Adicionar createdById ao schema e ao serviço de leads</name>
  <files>prisma/schema.prisma</files>
  <files>lib/services/lead.service.ts</files>
  <action>
    Em `prisma/schema.prisma`, adicionar no model Lead (após `qualifiedById String?`):
    ```
    createdById    String?
    createdBy      User?               @relation("CreatedLeads", fields: [createdById], references: [id])
    ```
    E adicionar o index: `@@index([createdById])`

    No model User, adicionar na lista de relações:
    ```
    createdLeads   Lead[]              @relation("CreatedLeads")
    ```

    Em `lib/services/lead.service.ts`:
    - Adicionar `createdById?: string` ao interface `CreateLeadData`
    - No método `createLead`, incluir `createdById: data.createdById` no objeto `data` do `prisma.lead.create`
    - No interface do filtro de `listLeads`, adicionar `createdById?: string`
    - No método `listLeads`, adicionar: `if (filters?.createdById) { where.createdById = filters.createdById; }`

    Após editar o schema, rodar:
    ```bash
    cd /Users/pauloloureiro/Dev/SigmaProjects/carreirahubproject && npm run db:push && npm run db:generate
    ```
  </action>
  <verify>
    `npm run db:push` e `npm run db:generate` concluem sem erros.
    Verificar que o campo `createdById` existe no schema gerado: `grep -n "createdById" prisma/schema.prisma`
  </verify>
  <done>Schema contém createdById no Lead, relação bidirecional com User, e o LeadService aceita e persiste createdById.</done>
</task>

<task type="auto">
  <name>Task 2: Aplicar filtro de vendedor na API e na página de leads</name>
  <files>app/api/leads/route.ts</files>
  <files>app/dashboard/leads/page.tsx</files>
  <action>
    Em `app/api/leads/route.ts`:

    No handler `POST`:
    - Importar `getServerSession` e `authOptions` no topo do arquivo (já existem se necessário)
    - Antes de chamar `leadService.createLead(data)`, obter sessão: `const session = await getServerSession(authOptions);`
    - Passar `createdById: (session?.user as any)?.id` ao `leadService.createLead({ ...data, createdById: ... })`

    No handler `GET`:
    - Obter sessão: `const session = await getServerSession(authOptions);`
    - Determinar role: `const role = (session?.user as any)?.role;`
    - Se `role === "SALES"`, adicionar `createdById: (session?.user as any)?.id` aos filtros passados a `leadService.listLeads`
    - ADMIN e SDR: sem filtro adicional (comportamento existente mantido)

    Em `app/dashboard/leads/page.tsx`:

    A página já busca diretamente via `prisma.lead.findMany`. Aplicar o filtro:
    - Após obter `userRole` da sessão, definir `const userId = (session.user as any).id as string;`
    - Construir `const whereClause = userRole === "SALES" ? { createdById: userId } : {};`
    - Passar `where: whereClause` em `prisma.lead.findMany({ where: whereClause, ... })`
    - Passar `where: whereClause` em `prisma.lead.count({ where: whereClause })`
    - Para o pipeline `groupBy`, também filtrar: `prisma.lead.groupBy({ by: ["status"], where: whereClause, _count: { id: true } })`

    Isso garante que contagens do pipeline também reflitam apenas os leads do vendedor.
  </action>
  <verify>
    `npm run build` passa sem erros de TypeScript.
    Testar com um usuário SALES: deve ver apenas seus próprios leads.
    Testar com ADMIN: deve ver todos os leads.
  </verify>
  <done>
    - Usuário SALES vê somente seus leads na listagem e no pipeline de contagens
    - ADMIN e SDR veem todos os leads sem alteração
    - Novo lead criado via formulário (/dashboard/leads/new) tem createdById = ID do usuário autenticado
  </done>
</task>

</tasks>

<verification>
1. `npm run db:push && npm run db:generate` sem erros
2. `npm run build` sem erros TypeScript
3. Checar que `prisma/schema.prisma` contém `createdById String?` no model Lead
4. Checar que `lib/services/lead.service.ts` tem `createdById` em `CreateLeadData` e no `where` de `listLeads`
5. Checar que `app/api/leads/route.ts` passa `createdById` no POST e filtra no GET para SALES
6. Checar que `app/dashboard/leads/page.tsx` usa `whereClause` baseado no role em findMany, count e groupBy
</verification>

<success_criteria>
- Schema atualizado e sincronizado com o banco (db:push ok)
- Build TypeScript passa sem erros
- Usuário SALES vê somente leads criados por ele
- ADMIN/SDR veem todos os leads
- Pipeline de contagens reflete somente leads visíveis ao usuário
</success_criteria>

<output>
Após conclusão, criar `.planning/quick/47-filtrar-leads-por-usuario-vendedor-cada-/47-SUMMARY.md`
</output>
