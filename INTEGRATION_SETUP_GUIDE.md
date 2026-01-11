# Guia de Configuração das Integrações - CarreiraHub

Este documento descreve como configurar completamente as integrações do QuickBooks e Pipedrive no sistema.

## 📋 Resumo

O CarreiraHub funciona como um **middleware centralizado** que:
- Puxa dados do QuickBooks e Pipedrive
- Permite criar invoices que sincronizam automaticamente
- Gerencia o fluxo completo: Leads → Deals → Contracts → Invoices
- Mantém tudo sincronizado entre os sistemas

---

## 🔧 Pré-requisitos

- ✅ QuickBooks Client ID e Client Secret (já configurados)
- ✅ Pipedrive API Token e Company Domain (já no .env)
- ✅ Banco de dados PostgreSQL (Neon)
- ✅ Deploy no Vercel

---

## 1️⃣ Fluxo de Autenticação do QuickBooks (OAuth 2.0)

### Passo 1: Acessar o Painel de Configuração

1. Entre no dashboard em `/dashboard/settings/integrations`
2. Localize a seção "QuickBooks"
3. Clique no botão "Conectar"

### Passo 2: Autorizar no Intuit

1. Você será redirecionado para o servidor de autorização Intuit
2. Faça login com sua conta QuickBooks
3. Autorize a aplicação a acessar seus dados
4. Você será redirecionado de volta para o CarreiraHub

### Passo 3: Verificar a Conexão

1. Volte para `/dashboard/settings/integrations`
2. Você verá:
   - Status: "✓ Conectado"
   - Company ID (Realm ID)
   - Data de expiração do token

### O que Acontece Automaticamente

- ✅ Access Token e Refresh Token são salvos no banco de dados
- ✅ Company ID é armazenado para futuras sincronizações
- ✅ Token expira automaticamente (QuickBooks renova a cada 1 hora)
- ✅ Refresh automático acontece quando o token expira

---

## 2️⃣ Configuração do Pipedrive

### Passo 1: Validar Credenciais

1. Certifique-se que no `.env` está:
   ```bash
   PIPEDRIVE_API_TOKEN=seu_token_aqui
   PIPEDRIVE_COMPANY_DOMAIN=sua_empresa_aqui
   ```

2. Vá para `/dashboard/settings/integrations`
3. Clique em "Testar Conexão" na seção Pipedrive
4. Você verá se as credenciais estão válidas

### Passo 2: Validar Tokens

Se o teste falhar:

**Erro: "Token de API inválido ou expirado"**
- Gere um novo token no Pipedrive
- Vá para: Pipedrive → Settings → Personal Preferences → API
- Copie o novo token
- Atualize `PIPEDRIVE_API_TOKEN` no `.env`
- Redeploy no Vercel

---

## 3️⃣ Configuração de Webhook Secrets

### Passo 1: Gerar Secrets

1. Vá para `/dashboard/settings/integrations`
2. Clique em "Gerar/Atualizar Secrets"
3. Três secrets são gerados:
   - QuickBooks Webhook Secret
   - Pipedrive Webhook Secret
   - Cron Secret

### Passo 2: Configurar no QuickBooks

1. Acesse: [Intuit Developer Portal](https://developer.intuit.com)
2. Vá para sua aplicação → Webhooks
3. Configure:
   - **Webhook URL**: `https://seu-dominio.com/api/webhooks/quickbooks`
   - **Webhook Verifier Token**: Cole o QuickBooks Webhook Secret

### Passo 3: Configurar no Pipedrive

1. Vá para: Pipedrive → Settings → Webhooks
2. Crie novos webhooks:
   - **Lead Webhook**
     - URL: `https://seu-dominio.com/api/webhooks/pipedrive/lead`
     - Events: Person Created, Person Updated
   - **Deal Webhook**
     - URL: `https://seu-dominio.com/api/webhooks/pipedrive/deal`
     - Events: Deal Updated (quando status = "won")

3. (Opcional) Configure a validação de assinatura:
   - Use o Pipedrive Webhook Secret para validar mensagens

---

## 4️⃣ URLs dos Webhooks

Use estas URLs ao configurar os webhooks:

### QuickBooks
```
POST https://seu-dominio.com/api/webhooks/quickbooks
GET https://seu-dominio.com/api/webhooks/quickbooks (verificação)
```

### Pipedrive - Lead
```
POST https://seu-dominio.com/api/webhooks/pipedrive/lead
```

### Pipedrive - Deal
```
POST https://seu-dominio.com/api/webhooks/pipedrive/deal
```

---

## 5️⃣ Sincronização Automática

A sincronização acontece **automaticamente**:

### QuickBooks
- **Frequência**: A cada 6 horas (configurado no Vercel)
- **Endpoint**: `GET /api/cron/quickbooks-sync`
- **O que sincroniza**:
  - Customers → Customers do CarreiraHub
  - Invoices → Invoices do CarreiraHub

### Pipedrive
- **Frequência**: Em tempo real via webhooks
- **O que sincroniza**:
  - Leads → Leads do CarreiraHub
  - Deals Won → Criar Contrato + Invoice + Acesso LMS

---

## 6️⃣ Fluxo de Dados (Middleware)

### Criação de Invoice no CarreiraHub

```
Dashboard → Criar Invoice
    ↓
POST /api/invoices/create
    ↓
- Validar/Criar Customer no QuickBooks
- Criar Invoice no QuickBooks
- Salvar localmente no CarreiraHub
- Retornar para o usuário
```

### Deal Won no Pipedrive

```
Pipedrive Webhook (Deal Won)
    ↓
POST /api/webhooks/pipedrive/deal
    ↓
- Validar assinatura do webhook
- Buscar dados do Deal
- Reconciliar Customer (Identity Mapper)
- Criar Deal no CarreiraHub
    ↓
Processo Assíncrono:
- Gerar Contrato (DocuSign)
- Criar Invoice (QuickBooks + Stripe)
- Liberar Acesso LMS
```

### Sincronização de Customers

```
QuickBooks → Customers
    ↓
Cron Job (a cada 6h)
    ↓
GET /api/cron/quickbooks-sync
    ↓
- Buscar todos os Customers do QB
- Reconciliar com Customers locais
- Atualizar/Criar localmente
- Logar em IntegrationLog
```

---

## 🔍 Testando as Integrações

### Teste 1: QuickBooks está conectado?

```bash
curl https://seu-dominio.com/api/system/status

# Resposta esperada:
# {
#   "quickbooks": {
#     "isAuthenticated": true,
#     "companyId": "1234567890",
#     "tokenExpiresAt": "2026-01-06T12:00:00Z"
#   }
# }
```

### Teste 2: Pipedrive está configurado?

```bash
curl https://seu-dominio.com/api/pipedrive/test

# Resposta esperada:
# {
#   "status": "success",
#   "message": "Conexão com Pipedrive validada com sucesso",
#   "configured": true,
#   "user": { "id": 123, "name": "John", "email": "john@..." }
# }
```

### Teste 3: Webhook Secrets estão configurados?

```bash
curl https://seu-dominio.com/api/system/secrets/generate

# Verifica se todos os secrets existem
```

---

## ⚠️ Troubleshooting

### "Quickbooks access token not configured"

**Solução**: Complete o fluxo OAuth em `/dashboard/settings/integrations`

### "Quickbooks company ID not configured"

**Solução**: O OAuth retornou sucesso mas o Company ID não foi salvo. Tente reconectar.

### "PIPEDRIVE_API_TOKEN não configurado"

**Solução**: Atualize o `.env` e redeploy no Vercel

### "Invalid webhook signature"

**Solução**: Verifique se o webhook secret configurado na plataforma corresponde ao salvo no banco

### Webhook não está sendo recebido

1. Verifique os logs do Vercel:
   ```
   Vercel Dashboard → Functions → Logs
   ```

2. Confirme que a URL do webhook está correta

3. Teste manualmente:
   ```bash
   curl -X POST https://seu-dominio.com/api/webhooks/pipedrive/lead \
     -H "Content-Type: application/json" \
     -d '{"test": "payload"}'
   ```

---

## 📊 Monitoramento

### Ver Logs de Sincronização

1. Vá para `/dashboard` (se implementado)
2. Seção "Integration Logs"
3. Filtrar por serviço (QUICKBOOKS, PIPEDRIVE)
4. Ver status, erros e retries

### Verificar Última Sincronização

```bash
curl https://seu-dominio.com/api/system/status | jq .lastSync

# Retorna:
# {
#   "quickbooks": "2026-01-05T12:00:00Z",
#   "pipedrive": "2026-01-05T10:30:45Z"
# }
```

---

## 🚀 Próximos Passos

- [ ] Completar OAuth do QuickBooks
- [ ] Testar conexão do Pipedrive
- [ ] Gerar webhook secrets
- [ ] Configurar webhooks em ambas plataformas
- [ ] Fazer primeiro teste de sincronização
- [ ] Configurar alertas para erros de integração

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs do Vercel
2. Verifique IntegrationLog no banco de dados
3. Confirme que todas as credenciais estão corretas
4. Teste cada componente isoladamente

---

**Última atualização**: Janeiro 2026
