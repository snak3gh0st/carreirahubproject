# 🔗 Guia de Configuração de Webhooks do Pipedrive

> 📘 **Baseado na documentação oficial:** [Pipedrive Webhooks v2 Guide](https://pipedrive.readme.io/docs/guide-for-webhooks-v2)

Este guia explica como configurar os webhooks do Pipedrive (v2) para integrar com o sistema Carreira AI Hub.

**Nota:** O código suporta tanto Webhooks v1 quanto v2 para compatibilidade.

## 📋 Webhooks Disponíveis

O sistema possui 2 endpoints de webhook para o Pipedrive:

1. **Webhook de Leads** - `/api/webhooks/pipedrive/lead`
   - Recebe notificações quando novos leads (Persons) são criados ou atualizados
   
2. **Webhook de Deals** - `/api/webhooks/pipedrive/deal`
   - Recebe notificações quando deals são ganhos (Won)

## 🌐 URLs dos Webhooks

### 🚀 Produção (app.carreirausa.com) - **USE ESTAS URLs**

```
https://app.carreirausa.com/api/webhooks/pipedrive/lead
https://app.carreirausa.com/api/webhooks/pipedrive/deal
```

**✅ Estas são as URLs que você deve usar ao configurar os webhooks no Pipedrive!**

### 🧪 Desenvolvimento (Local)

Para testar localmente, você precisará usar um túnel como [ngrok](https://ngrok.com/):

```
http://localhost:3000/api/webhooks/pipedrive/lead
http://localhost:3000/api/webhooks/pipedrive/deal
```

**Nota:** O Pipedrive precisa de uma URL HTTPS pública, então use ngrok para expor seu localhost durante o desenvolvimento.

## ⚡ Configuração Rápida (Resumo)

**URLs de Produção para copiar e colar:**

1. **Webhook de Leads:**
   ```
   https://app.carreirausa.com/api/webhooks/pipedrive/lead
   ```

2. **Webhook de Deals:**
   ```
   https://app.carreirausa.com/api/webhooks/pipedrive/deal
   ```

**Eventos necessários:**
- **Leads:** Ação `added` + Objeto `person`
- **Deals:** Ação `updated` + Objeto `deal`

---

## 📝 Configuração Passo a Passo (Detalhado)

### Webhook 1: Novos Leads (Persons)

#### 1. Acesse o Pipedrive
1. Faça login no Pipedrive
2. Vá em **Configurações** → **Integrações** → **Webhooks**
3. Clique em **Criar novo webhook**

#### 2. Configure os Eventos

**Seção: Eventos no Pipedrive**

- **Ação do evento:** Selecione `create` (Criar) - **Webhooks v2**
- **Objeto do evento:** Selecione `person` (Pessoa)
- **Nível de permissão do usuário:** Selecione seu usuário (ex: "Roger Ferreira (você)")

**Eventos adicionais (opcional):**
Para também receber atualizações de leads existentes, você pode criar um segundo webhook:
- **Ação do evento:** `change` (Alterar) - **Webhooks v2**
- **Objeto do evento:** `person` (Pessoa)

#### 3. Configure o Endpoint

**Seção: Ponto de extremidade fora do Pipedrive**

- **Nome do webhook:** `Carreira AI Hub - Novos Leads`
- **URL do Ponto de Extremidade:** 
  ```
  https://app.carreirausa.com/api/webhooks/pipedrive/lead
  ```
  
  **Para desenvolvimento local (usando ngrok):**
  ```
  https://seu-ngrok-url.ngrok.io/api/webhooks/pipedrive/lead
  ```

- **Nome de usuário autent. HTTP:** (Deixe em branco)
- **Senha autent. HTTP:** (Deixe em branco)

#### 4. Salvar
Clique em **Salvar** ou **Criar webhook**

---

### Webhook 2: Deals Ganhos (Won)

#### 1. Criar Novo Webhook
No mesmo local, clique em **Criar novo webhook** novamente

#### 2. Configure os Eventos

**Seção: Eventos no Pipedrive**

- **Ação do evento:** Selecione `change` (Alterar) - **Webhooks v2**
- **Objeto do evento:** Selecione `deal` (Negócio)
- **Nível de permissão do usuário:** Selecione seu usuário

**Nota:** O sistema filtra automaticamente apenas deals com status "won" (ganho), então você pode configurar para receber todas as atualizações de deals.

#### 3. Configure o Endpoint

**Seção: Ponto de extremidade fora do Pipedrive**

- **Nome do webhook:** `Carreira AI Hub - Deals Ganhos`
- **URL do Ponto de Extremidade:** 
  ```
  https://app.carreirausa.com/api/webhooks/pipedrive/deal
  ```
  
  **Para desenvolvimento local (usando ngrok):**
  ```
  https://seu-ngrok-url.ngrok.io/api/webhooks/pipedrive/deal
  ```

- **Nome de usuário autent. HTTP:** (Deixe em branco)
- **Senha autent. HTTP:** (Deixe em branco)

#### 4. Salvar
Clique em **Salvar** ou **Criar webhook**

---

## 🔐 Segurança (Opcional mas Recomendado)

Para maior segurança, você pode configurar validação de assinatura dos webhooks:

### 1. Gerar um Secret
Gere uma string aleatória segura (ex: usando `openssl rand -hex 32`)

### 2. Configurar no .env
Adicione ao seu arquivo `.env`:
```bash
PIPEDRIVE_WEBHOOK_SECRET="sua_string_secreta_aqui"
```

### 3. Configurar no Pipedrive
No Pipedrive, ao criar o webhook, você pode configurar autenticação HTTP básica ou usar o campo de assinatura (se disponível na interface).

**Nota:** Atualmente, o sistema valida a assinatura usando o header `x-pipedrive-signature` se `PIPEDRIVE_WEBHOOK_SECRET` estiver configurado.

---

## 🧪 Testando os Webhooks

### Teste Manual

1. **Teste de Lead:**
   - Crie uma nova pessoa no Pipedrive
   - Verifique os logs do servidor para ver se o webhook foi recebido
   - Verifique no banco de dados se um novo Lead foi criado

2. **Teste de Deal:**
   - Crie um deal no Pipedrive
   - Mude o status para "Won" (Ganho)
   - Verifique os logs do servidor
   - Verifique se o processo de geração de contrato/fatura foi iniciado

### Verificar Logs

Os webhooks logam todas as ações em `IntegrationLog`. Você pode verificar:

**Via Swarm host:**
1. Acesse `ssh carreirausa`
2. Verifique os logs do serviço `carreirahub_hub`
3. Cruze com os registros em `IntegrationLog`

**Via Banco de Dados:**
```sql
SELECT * FROM "IntegrationLog" 
WHERE service = 'PIPEDRIVE' 
ORDER BY created_at DESC 
LIMIT 10;
```

Ou via Prisma Studio:
```bash
npm run db:studio
```

---

## 📊 Eventos Suportados

### Webhook de Leads (`/api/webhooks/pipedrive/lead`)

Suporta os seguintes eventos (v1 e v2):
- **v2:** `create.person` - Nova pessoa criada
- **v2:** `change.person` - Pessoa atualizada
- **v1 (legado):** `added.person`, `updated.person`
- **v1 (legado):** `added.deal`, `updated.deal` - Busca o person associado

### Webhook de Deals (`/api/webhooks/pipedrive/deal`)

Suporta os seguintes eventos (v1 e v2):
- **v2:** `change.deal` - Deal alterado (processa apenas se status = "won")
- **v1 (legado):** `updated.deal` - Deal atualizado (processa apenas se status = "won")

---

## 🔄 Fluxo de Processamento

### Quando um Lead é recebido:

1. ✅ Valida assinatura do webhook (se configurado)
2. ✅ Extrai Person ID do payload
3. ✅ Busca dados completos do Person via Pipedrive API
4. ✅ Cria ou atualiza Lead no banco de dados
5. ✅ Dispara qualificação automática via SDR Service
6. ✅ Envia mensagem de boas-vindas via WhatsApp (se tiver telefone)
7. ✅ Registra log de integração

### Quando um Deal é ganho:

1. ✅ Valida assinatura do webhook (se configurado)
2. ✅ Extrai Deal ID e Person ID do payload
3. ✅ Busca dados completos do Deal via Pipedrive API
4. ✅ Verifica se Lead existe e converte para CONVERTED
5. ✅ Reconcilia Customer via Identity Mapper
6. ✅ Cria/Atualiza Deal no banco
7. ✅ Dispara processo assíncrono:
   - Gera Contrato (DocuSign)
   - Cria Fatura (Stripe/QuickBooks)
   - Libera acesso ao LMS
8. ✅ Registra log de integração

---

## 🛠️ Desenvolvimento Local com ngrok

Para testar webhooks localmente:

### 1. Instalar ngrok
```bash
# macOS
brew install ngrok

# ou baixe de https://ngrok.com/download
```

### 2. Iniciar o servidor local
```bash
npm run dev
```

### 3. Expor o localhost
```bash
ngrok http 3000
```

### 4. Usar a URL do ngrok
Copie a URL HTTPS fornecida pelo ngrok (ex: `https://abc123.ngrok.io`) e use nos webhooks:
```
https://abc123.ngrok.io/api/webhooks/pipedrive/lead
https://abc123.ngrok.io/api/webhooks/pipedrive/deal
```

**Nota:** A URL do ngrok muda a cada vez que você reinicia (na versão gratuita). Para desenvolvimento, considere usar a versão paga com URL fixa.

---

## ❓ Troubleshooting

### Webhook não está sendo recebido

1. **Verifique a URL:**
   - Certifique-se de que a URL está correta e acessível
   - Teste a URL manualmente (deve retornar 200 ou 400, não 404)

2. **Verifique os logs:**
   ```bash
   # No terminal onde o servidor está rodando
   # Você deve ver logs como:
   # [Webhook] Received Pipedrive webhook: ...
   ```

3. **Verifique o Pipedrive:**
   - Vá em Configurações → Integrações → Webhooks
   - Verifique se o webhook está ativo
   - Veja o histórico de entregas (se disponível)

### Erro 401 (Unauthorized)

- Verifique se `PIPEDRIVE_WEBHOOK_SECRET` está configurado corretamente
- Verifique se a assinatura está sendo enviada no header `x-pipedrive-signature`

### Erro 400 (Bad Request)

- Verifique se o payload contém os campos necessários (person_id ou deal_id)
- Verifique os logs para ver qual campo está faltando

### Lead não está sendo criado

- Verifique se o Person no Pipedrive tem um email (obrigatório)
- Verifique os logs de erro no servidor
- Verifique se há algum problema de conexão com o banco de dados

---

## 📚 Recursos Adicionais

- [Documentação de Webhooks do Pipedrive](https://pipedrive.readme.io/docs/core-api-concepts-webhooks)
- [API do Pipedrive](https://developers.pipedrive.com/docs/api/v1)

---

## ✅ Checklist de Configuração

- [ ] Webhook de Leads criado no Pipedrive
- [ ] Webhook de Deals criado no Pipedrive
- [ ] URLs configuradas corretamente (produção: `app.carreirausa.com` ou ngrok para desenvolvimento)
- [ ] Eventos configurados corretamente
- [ ] `PIPEDRIVE_WEBHOOK_SECRET` configurado (opcional mas recomendado)
- [ ] Teste de criação de Lead realizado
- [ ] Teste de Deal Won realizado
- [ ] Logs verificados e funcionando

---

---

## 🎯 URLs Finais para Configuração

**Copie e cole estas URLs no Pipedrive:**

### Webhook 1: Novos Leads
```
https://app.carreirausa.com/api/webhooks/pipedrive/lead
```
- **Evento:** `added.person`
- **Objeto:** `person`

### Webhook 2: Deals Ganhos
```
https://app.carreirausa.com/api/webhooks/pipedrive/deal
```
- **Evento:** `updated.deal`
- **Objeto:** `deal`

---

**Última atualização:** Dezembro 2024  
**Domínio de Produção:** `app.carreirausa.com`
