# Hub do Cliente — Redesign UX/UI

**Data:** 2026-04-29  
**Status:** Aprovado para implementação  
**Escopo:** Redesign completo do portal `/hub/*` — visual moderno e friendly, navegação por seções, dados dos 3 sistemas (comercial, operacional, financeiro)

---

## Objetivo

Transformar o hub do cliente de um portal funcional num portal de excelência que reflete o valor que o cliente está pagando. Cada seção deve ser imediatamente compreensível, visualmente coerente e mostrar dados reais do sistema.

---

## Estrutura de Navegação

### Header (mantém posição no topo — não sidebar)

```
[Logo C] Carreira Hub | Início  Financeiro  Meu Programa  Documentos | [EN] [Avatar João ⚙️]
```

- Logo: ícone quadrado verde escuro com "C" em tangerina
- Links ativos: sublinhado tangerina + cor tangerina
- Links inativos: creme com 65% opacidade
- Direita: toggle de idioma (pill) + avatar clicável que leva a Conta
- Mobile: menu hamburger com as mesmas 4 seções + Conta

### 5 Seções Principais

| Seção | Rota | Sistemas |
|-------|------|----------|
| Início | `/hub` | Todos |
| Financeiro | `/hub/financeiro` | Financeiro |
| Meu Programa | `/hub/programa` | Operacional + Comercial |
| Documentos | `/hub/documentos` | Comercial + Financeiro |
| Conta | `/hub/conta` | Hub |

> **Nota de roteamento:** As rotas atuais (`/hub/pay/[id]`, `/hub/forms`, `/hub/status`, `/hub/test`, `/hub/documents`, `/hub/settings`) continuam funcionando internamente. As novas seções agregam e reorganizam o conteúdo dessas rotas sob uma navegação unificada.

---

## Design por Seção

### 1. Início (`/hub`)

**Propósito:** HQ do cliente — visão geral de tudo com CTAs inteligentes.

**Componentes (top→bottom):**

1. **Welcome hero card** (branco, borda sutil)
   - Esquerda: "Olá, [Nome] 👋" + "Programa [X] · Desde [Mês Ano]"
   - Direita: pill circular com fase atual (ex: "3 / 6 · Conversação")

2. **Smart alert banner** (condicional — só aparece se há ação urgente)
   - Fatura vencendo: fundo vermelho claro, borda vermelha, botão "Pagar agora"
   - Form pendente: fundo tangerina claro, "2 forms aguardando resposta"
   - Lógica de prioridade: fatura vencida > fatura vencendo > form pendente > nenhum

3. **4 KPI cards** (grid 4 colunas)
   - Em aberto: valor em vermelho
   - Total pago: valor em verde
   - Nível de inglês: CEFR badge azul
   - Forms pendentes: contagem em tangerina

4. **Quick nav cards** (grid 4 colunas)
   - Financeiro, Meu Programa, Documentos
   - Se tiver form pendente: 4º card com borda tangerina e CTA "Preencher agora →"

**Dados necessários:**
- `GET /api/hub/invoices` — faturas abertas + total pago
- `GET /api/hub/status` — fase atual do programa + nome
- `GET /api/hub/test/result` (latest) — nível CEFR
- `GET /api/hub/forms` — count de pendentes

---

### 2. Financeiro (`/hub/financeiro`)

**Propósito:** Visão financeira completa — parcelas, faturas, recibos.

**Componentes:**

1. **3 KPI cards** (grid 3 colunas)
   - Em aberto (vermelho se > 0)
   - Total pago (verde)
   - Próximo vencimento (data + valor)

2. **Barra de progresso de parcelas**
   - Segmentos coloridos: verde (pagas) | vermelho (em aberto/vencida) | cinza (futuras)
   - Legenda: "X pagas · Y em aberto · Z futuras · Total R$N"

3. **Faturas em aberto** (card destacado com borda colorida)
   - Uma card por fatura aberta/vencida/parcialmente paga
   - Badge de status (VENCE EM X DIAS / VENCIDA HÁ X DIAS)
   - Valor grande + botão "Pagar agora"

4. **Histórico de pagamentos** (tabela compacta)
   - Colunas: Nº fatura, parcela, data, valor, status badge, link "Recibo →"
   - Ordenado por data desc

**Dados necessários:**
- `GET /api/hub/invoices` — todas as faturas

---

### 3. Meu Programa (`/hub/programa`)

**Propósito:** Jornada completa — onboarding, fase atual, forms, inglês.

**Componentes:**

1. **Hero do programa** (fundo verde escuro gradiente)
   - Nome do programa + data de início + total de fases/duração
   - Badge circular direita: fase atual (N/Total)

2. **Layout 2 colunas:**

   **Coluna esquerda — Jornada de onboarding (timeline)**
   - Etapas fixas (sempre nesta ordem):
     1. Contrato assinado
     2. Primeiro pagamento
     3. Forms de onboarding (mostra N/N concluídos)
     4. Teste de inglês (mostra nível CEFR se feito)
     5. Mentoria — Fase atual (destaque tangerina)
   - Estados: ✓ verde (concluído) | círculo tangerina pulsante (atual) | círculo cinza (pendente)

   **Coluna direita — Forms + Teste de inglês**

   *Forms do operacional:*
   - Pendentes: bullet tangerina + título + data envio + botão "Preencher →"
   - Concluídos: bullet verde + título em cinza + "✓ Enviado"

   *Teste de inglês:*
   - Card com badge nível (ex: B2) + "Upper Intermediate"
   - Data + acertos (ex: "21/25")
   - Mini barras por seção (Gramática, Vocabulário, Leitura, Listening, Writing)
   - Link "Ver resultado completo →"
   - Se não fez: CTA "Fazer teste agora"

**Dados necessários:**
- `GET /api/hub/status` — etapas de onboarding + fase atual
- `GET /api/hub/forms` — forms com status
- `GET /api/hub/test/result` — resultado do teste

---

### 4. Documentos (`/hub/documentos`)

**Propósito:** Arquivo legal e financeiro do cliente.

**Componentes:**

1. **Seção: Contratos assinados**
   - Ícone PDF + nome do contrato + data assinatura + badge "DocuSign verificado"
   - Botões: "Visualizar" (abre em nova aba) + "Download" (verde escuro)

2. **Seção: Recibos de pagamento**
   - Tabela: Nº fatura + parcela, data, valor, botões "Ver" + "PDF"
   - Ordenado por data desc (mais recente primeiro)

**Empty states:**
- Sem contratos: "Nenhum contrato assinado ainda. Entre em contato com sua equipe Carreira."
- Sem recibos: aparece naturalmente vazio (não mostra a seção)

**Dados necessários:**
- `GET /api/hub/documents` — contratos (deals com signed_at + pdf_url)
- `GET /api/hub/invoices?status=paid` — recibos de faturas pagas

---

### 5. Conta (`/hub/conta`)

**Propósito:** Configurações pessoais simples.

**Componentes (max-width: 520px, centralizado):**

1. **Avatar hero** — iniciais em gradiente verde→tangerina + nome + email + badge "Conta ativa · [Programa]"

2. **Card: Idioma** — dois botões com flag (🇺🇸 English / 🇧🇷 Português), ativo com borda tangerina

3. **Card: Alterar senha** — campos senha atual + nova + confirmar + botão "Atualizar senha"

4. **Link Sair** — vermelho, discreto, no rodapé

**Dados necessários:**
- JWT payload — nome, email, idioma atual
- `GET /api/hub/profile` — dados do perfil

---

## Sistema de Design

### Tokens (mantém os existentes)

```
--brand-verde:     #2F443F
--brand-tangerina: #FF8142
--brand-creme:     #FFF8E8
--brand-cafe:      #E1C19B
```

### Padrões de card

- Fundo: branco
- Borda: `1px solid #e2e8f0` (gray-200)
- Radius: `rounded-xl` (12px) ou `rounded-2xl` (16px) para cards maiores
- Sombra: `shadow-sm`

### Estados de fatura (cores semânticas)

| Status | Borda | Fundo badge | Texto |
|--------|-------|-------------|-------|
| OVERDUE | `border-red-300` | `bg-red-50` | `text-red-600` |
| SENT (vencendo em ≤7d) | `border-orange-300` | `bg-orange-50` | `text-orange-600` |
| SENT | `border-gray-200` | `bg-gray-100` | `text-gray-600` |
| PARTIALLY_PAID | `border-yellow-300` | `bg-yellow-50` | `text-yellow-700` |
| PAID | sem destaque | `bg-green-50` | `text-green-700` |

### Tipografia

- Títulos de seção: `text-sm font-bold text-slate-900`
- Labels: `text-xs font-semibold text-slate-400 uppercase tracking-wide`
- Valores financeiros: `text-xl font-extrabold` (ou `text-2xl` para KPIs principais)
- Corpo: `text-sm text-slate-600`
- Muted: `text-xs text-slate-400`

---

## i18n

Todas as strings novas adicionadas ao namespace existente em `lib/i18n/hub.ts`. Estrutura atual mantida (`t(lang, "section.key")`). Novas chaves a adicionar:

```
navigation.inicio, navigation.financeiro, navigation.programa, navigation.documentos, navigation.conta
inicio.greeting, inicio.program, inicio.phase
inicio.alert.invoiceDue, inicio.alert.formPending
financeiro.installmentPlan, financeiro.history
programa.heroSubtitle, programa.journey.*
documentos.contracts.verified, documentos.receipts.*
conta.status
```

---

## Mobile

- Header: logo + hamburger menu (drawer lateral com as 5 seções)
- Grids de 4 colunas colapsam para 2 colunas em mobile
- Timeline de onboarding: full width, vertical
- Layout 2 colunas (Programa): empilha em coluna única
- Tabelas (Documentos/Financeiro): cards empilhados no mobile

---

## O que NÃO muda

- Rotas de API — nenhuma quebra de contrato
- Lógica de autenticação (JWT hub-token)
- Página de pagamento (`/hub/pay/[id]`) — layout mantido
- Teste de inglês (`/hub/test`) — layout mantido (já está bom)
- Fluxo de reset/set-password — mantido

---

## Fora de escopo

- Redesign da página de pagamento
- Redesign do teste de inglês (5 seções de questões)
- Notificações push / Telegram no hub (fase futura)
- Novo conteúdo de fases/mentoria (depende de dados operacionais não mapeados)
