# Carreira AI Hub - Middleware Proprietário

Sistema centralizado de gerenciamento de leads, vendas e operações para Carreira U.S.A, substituindo ferramentas No-Code/SaaS caras por um middleware proprietário em código puro.

## 🎯 Objetivos

- **Redução de OPEX:** Cortar custos de tecnologia (~$17.6k/mês) em 66%
- **SSOT (Single Source of Truth):** Eliminar "Cegueira de Dados" unificando Pipedrive, Financeiro e Operacional
- **Estabilidade:** Substituir automações frágeis de N8N por rotas de API robustas

## 🏗️ Arquitetura

- **Frontend:** Next.js 14+ (App Router) + TailwindCSS + ShadcnUI
- **Backend:** Next.js API Routes (Node.js/TypeScript)
- **Database:** PostgreSQL (Neon) + Prisma ORM
- **Infraestrutura:** Vercel Serverless Functions

## 🚀 Início Rápido

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

Copie `.env` e preencha as variáveis necessárias:

```bash
# Database
POSTGRES_PRISMA_URL="..."
POSTGRES_URL_NON_POOLING="..."

# APIs
PIPEDRIVE_API_TOKEN="..."
STRIPE_SECRET_KEY="..."
OPENAI_API_KEY="..."
# ... outras variáveis
```

### 3. Configurar Banco de Dados

```bash
# Gerar Prisma Client
npm run db:generate

# Aplicar schema ao banco
npm run db:push

# Criar views SQL para métricas
npm run db:views
```

### 4. Executar Servidor

```bash
npm run dev
```

Acesse: `http://localhost:3000`

## 📁 Estrutura do Projeto

```
carreira-ai-hub/
├── app/
│   ├── api/              # API Routes
│   │   ├── chat/         # Chatbot API
│   │   ├── leads/        # CRUD de leads
│   │   ├── conversations/# CRUD de conversas
│   │   ├── webhooks/     # Webhooks (Pipedrive, WhatsApp)
│   │   └── ...
│   ├── dashboard/        # Dashboard Next.js
│   └── page.tsx          # Página inicial
├── lib/
│   ├── services/         # Services de integração
│   │   ├── ai.service.ts
│   │   ├── lead.service.ts
│   │   ├── sdr.service.ts
│   │   ├── pipedrive.service.ts
│   │   ├── stripe.service.ts
│   │   └── ...
│   ├── prompts/          # Prompts para AI
│   └── utils/            # Utilitários
├── prisma/
│   ├── schema.prisma     # Schema do banco
│   └── migrations/        # Migrations e views SQL
└── scripts/              # Scripts utilitários
```

## 🔌 Integrações

### Pipedrive
- Webhook: Novo Lead criado → Qualificação automática
- Webhook: Deal Won → Gerar Contrato + Fatura + Liberar LMS

### WhatsApp (Twilio)
- Webhook: Mensagem recebida → Processar via Chatbot AI
- Envio automático de mensagens de qualificação

### Stripe & Quickbooks
- Criação automática de invoices
- Sincronização de customers

### DocuSign
- Geração automática de contratos
- Envio para assinatura

### OpenAI
- Chatbot de Customer Service
- Qualificação automática de leads

## 📊 Funcionalidades Principais

### SDR (Sales Development Representative)
- ✅ Qualificação automática de leads via AI
- ✅ Pipeline de leads (NEW → QUALIFYING → QUALIFIED → CONVERTED)
- ✅ Atribuição automática para SDR humano quando necessário
- ✅ Mensagens automáticas via WhatsApp

### Customer Service AI
- ✅ Chatbot inteligente para atendimento
- ✅ Qualificação automática durante conversas
- ✅ Escalação para humano quando necessário
- ✅ Histórico completo de conversas

### Vendas & Financeiro
- ✅ Workflow completo: Deal Won → Contrato → Fatura → LMS
- ✅ Motor financeiro proprietário (parcelas, multas, juros)
- ✅ Integração com Stripe e Quickbooks
- ✅ Dashboard de métricas financeiras

### Dashboard & BI
- ✅ Métricas em tempo real
- ✅ Funil de conversão
- ✅ Performance de SDRs
- ✅ Views SQL materializadas para relatórios rápidos

## 🔐 Autenticação & RBAC

- **Roles:** ADMIN, SALES, SDR, FINANCE, SUPPORT, OPERATIONAL
- **Middleware:** Proteção de rotas baseada em role
- **NextAuth:** Autenticação via credentials (configurar em produção)

## 📝 APIs Principais

### Chatbot
- `POST /api/chat` - Enviar mensagem ao chatbot
- `GET /api/chat/[conversationId]` - Histórico de conversa

### Leads
- `GET /api/leads` - Listar leads
- `POST /api/leads` - Criar lead
- `GET /api/leads/[id]` - Buscar lead
- `PATCH /api/leads/[id]` - Atualizar lead
- `POST /api/leads/[id]/qualify` - Qualificar lead

### Webhooks
- `POST /api/webhooks/pipedrive/lead` - Webhook novo lead
- `POST /api/webhooks/pipedrive/deal` - Webhook deal won
- `POST /api/webhooks/whatsapp` - Webhook mensagem WhatsApp

### Documentação
- `GET /api/docs` - OpenAPI/Swagger spec

## 🗄️ Views SQL Materializadas

Execute `npm run db:views` para criar as views:

- `lead_conversion_funnel` - Funil de conversão
- `sdr_performance` - Performance de SDRs
- `ai_chat_metrics` - Métricas do chatbot
- `lead_source_performance` - Performance por fonte
- `customer_lifetime_value` - LTV por customer
- `cac_by_channel` - CAC por canal
- `overdue_invoices` - Invoices vencidas
- `tech_cost_per_student` - Custo por aluno

## 🧪 Próximos Passos

1. Configurar autenticação completa (NextAuth com providers)
2. Adicionar gráficos ao dashboard (Recharts)
3. Implementar testes unitários
4. Configurar webhooks no Pipedrive e Twilio
5. Adicionar monitoramento e alertas

## 📚 Documentação

- [Plano de Execução](./.cursor/plans/carreira_ai_hub_-_middleware_proprietário_34d5755c.plan.md)
- [API Docs](./app/api/docs/route.ts) - OpenAPI spec

## 🤝 Contribuindo

Este é um projeto proprietário da Carreira U.S.A.

---

**Desenvolvido com ❤️ para reduzir OPEX e eliminar cegueira de dados**

