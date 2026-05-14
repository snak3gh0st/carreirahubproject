# Scripts de Teste e Seed

Este diretório contém scripts úteis para desenvolvimento e testes.

## Scripts Disponíveis

### 1. `create-test-user.js` / `create-test-user.ts`
Cria um usuário de teste no banco de dados.

**Uso:**
```bash
# JavaScript
npm run user:create

# Com parâmetros customizados
node scripts/create-test-user.js email@example.com "Nome do Usuário" ADMIN
```

**Parâmetros:**
- `email` (opcional): Email do usuário (padrão: `admin@carreirausa.com`)
- `name` (opcional): Nome do usuário (padrão: `Admin User`)
- `role` (opcional): Role do usuário (padrão: `ADMIN`)

**Roles disponíveis:** `ADMIN`, `SALES`, `SDR`, `FINANCE`, `SUPPORT`, `OPERATIONAL`, `HEAD_OPERACIONAL`

---

### 2. `seed-test-data.js` / `seed-test-data.ts`
Popula o banco de dados com dados de teste completos.

**Uso:**
```bash
# JavaScript (recomendado)
npm run db:seed

# TypeScript
npx tsx scripts/seed-test-data.ts

# Com limpeza prévia (TypeScript)
npx tsx scripts/seed-test-data.ts --clear
```

**O que é criado:**
- ✅ **5 Usuários** com diferentes roles (ADMIN, SDR, SALES, FINANCE, SUPPORT)
- ✅ **7 Leads** com diferentes statuses (NEW, QUALIFYING, QUALIFIED, UNQUALIFIED, CONVERTED, LOST)
- ✅ **3 Customers** com IDs externos (Pipedrive, QuickBooks, Stripe)
- ✅ **4 Deals** com diferentes statuses (OPEN, WON, LOST)
- ✅ **4 Invoices** com diferentes statuses (PAID, OVERDUE, SENT, DRAFT)
- ✅ **3 Conversations** com mensagens (ACTIVE, ESCALATED, RESOLVED)
- ✅ **3 Lead Qualifications** com scores e critérios
- ✅ **5 Integration Logs** de diferentes serviços

**Opções:**
- `--clear`: Limpa todos os dados antes de popular (use com cuidado!)

---

### 3. `clear-database.js`
Limpa todos os dados do banco de dados, mantendo apenas o usuário admin padrão.

**Uso:**
```bash
npm run db:clear
```

**⚠️ ATENÇÃO:** Este script remove TODOS os dados do banco (exceto `admin@carreirausa.com`)!

---

## Fluxo Recomendado

### Primeira vez / Reset completo:
```bash
# 1. Limpar banco (opcional)
npm run db:clear

# 2. Popular com dados de teste
npm run db:seed
```

### Adicionar mais dados sem limpar:
```bash
# Apenas popular (usa upsert, não duplica)
npm run db:seed
```

### Criar usuário específico:
```bash
npm run user:create
# ou
node scripts/create-test-user.js sdr@test.com "SDR Test" SDR
```

---

## Dados de Teste Criados

### Usuários
- `admin@carreirausa.com` - ADMIN
- `sdr@carreirausa.com` - SDR
- `sales@carreirausa.com` - SALES
- `finance@carreirausa.com` - FINANCE
- `support@carreirausa.com` - SUPPORT

### Leads de Exemplo
- João Silva - NEW (Website)
- Maria Santos - QUALIFYING (WhatsApp)
- Pedro Oliveira - QUALIFIED (Referral, Score: 85)
- Ana Costa - QUALIFIED (Social Media, Score: 92)
- Carlos Ferreira - UNQUALIFIED (Website, Score: 35)
- Julia Rodrigues - CONVERTED (WhatsApp, Score: 95)
- Roberto Alves - LOST (Referral, Score: 40)

### Customers
- Empresa Alpha Ltda (com IDs externos)
- Empresa Beta S.A. (com IDs externos)
- Julia Rodrigues (convertida de lead)

### Deals
- Pacote Premium - Julia Rodrigues (OPEN, $15,000)
- Contrato Anual - Empresa Alpha (WON, $50,000)
- Pacote Básico - Empresa Beta (OPEN, $8,000)
- Oportunidade Perdida (LOST, $12,000)

### Invoices
- INV-2024-001: PAID ($15,000)
- INV-2024-002: OVERDUE ($50,000)
- INV-2024-003: SENT ($8,000)
- INV-2024-004: DRAFT ($12,000)

---

## Notas

- Todos os scripts usam `upsert` quando possível, então executar múltiplas vezes não cria duplicatas
- O script de seed mantém o usuário `admin@carreirausa.com` se já existir
- IDs externos (Pipedrive, QuickBooks, Stripe) são fictícios para testes
- Datas são geradas dinamicamente (algumas no passado, outras no futuro)

---

## Troubleshooting

**Erro: "User already exists"**
- Normal! O script usa `upsert`, então atualiza dados existentes

**Erro: "Foreign key constraint"**
- Execute `npm run db:clear` primeiro para limpar relacionamentos

**Erro: "Prisma Client not generated"**
- Execute `npm run db:generate` antes de rodar os scripts
