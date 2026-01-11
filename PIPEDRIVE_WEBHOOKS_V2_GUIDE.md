# 🔗 Guia Completo: Pipedrive Webhooks v2

> 📘 **Documentação Oficial:** [Pipedrive Webhooks v2 Guide](https://pipedrive.readme.io/docs/guide-for-webhooks-v2)

## 📋 Sobre Webhooks v2

Os **Webhooks v2** do Pipedrive trazem:
- ✅ **Maior confiabilidade** - Reduz duplicatas e webhooks perdidos
- ✅ **Melhor debugging** - Mais informações no payload
- ✅ **Suporte a Leads** - Agora você pode criar webhooks para `lead`
- ✅ **Formato padronizado** - Estrutura consistente do payload

## 🎯 Eventos Suportados

### Event Actions (Ações)
- `create` - Quando um objeto é criado
- `change` - Quando um objeto é alterado
- `delete` - Quando um objeto é deletado

### Event Objects (Objetos)
- `activity` - Atividades
- `deal` - Negócios
- `lead` - Leads (novo no v2!)
- `note` - Notas
- `organization` - Organizações
- `person` - Pessoas
- `pipeline` - Pipelines
- `product` - Produtos
- `stage` - Estágios
- `user` - Usuários

## 📝 Configuração dos Webhooks

### Webhook 1: Novos Leads (Persons)

**Via Interface Web do Pipedrive:**
1. Acesse: **Configurações** → **Ferramentas e apps** → **Webhooks**
2. Clique em **Criar novo webhook**

**Configuração:**
- **Ação do evento:** `create`
- **Objeto do evento:** `person`
- **URL:** `https://carreirausa.sigmaintel.io/api/webhooks/pipedrive/lead`
- **Nome:** `Carreira AI Hub - Novos Leads`

**Via API (POST /v1/webhooks):**
```json
{
  "subscription_url": "https://carreirausa.sigmaintel.io/api/webhooks/pipedrive/lead",
  "event_action": "create",
  "event_object": "person",
  "version": "2.0",
  "name": "Carreira AI Hub - Novos Leads"
}
```

---

### Webhook 2: Deals Ganhos (Won)

**Via Interface Web do Pipedrive:**
1. Acesse: **Configurações** → **Ferramentas e apps** → **Webhooks**
2. Clique em **Criar novo webhook**

**Configuração:**
- **Ação do evento:** `change`
- **Objeto do evento:** `deal`
- **URL:** `https://carreirausa.sigmaintel.io/api/webhooks/pipedrive/deal`
- **Nome:** `Carreira AI Hub - Deals Ganhos`

**Via API (POST /v1/webhooks):**
```json
{
  "subscription_url": "https://carreirausa.sigmaintel.io/api/webhooks/pipedrive/deal",
  "event_action": "change",
  "event_object": "deal",
  "version": "2.0",
  "name": "Carreira AI Hub - Deals Ganhos"
}
```

---

## 📦 Formato do Payload v2

O formato do webhook v2 é diferente do v1:

```json
{
  "meta": {
    "action": "create",
    "entity": "person",
    "company_id": "xxxxx",
    "correlation_id": "xxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "entity_id": "xxx",
    "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "is_bulk_edit": false,
    "timestamp": "2023-01-01T00:00:00.000Z",
    "type": "general",
    "user_id": "xxxxx",
    "version": "2.0",
    "webhook_id": "xxx",
    "webhook_owner_id": "xxxxxx",
    "change_source": "app",
    "attempt": 1,
    "host": "company.pipedrive.com",
    "permitted_user_ids": ["123", "456", "789"]
  },
  "data": {
    // Dados atuais do objeto
  },
  "previous": {
    // Dados anteriores (apenas campos que mudaram)
  }
}
```

### Diferenças do v1 para v2

| Aspecto | v1 | v2 |
|---------|----|----|
| Evento | `added.person`, `updated.deal` | `create.person`, `change.deal` |
| Estrutura | `body.event`, `body.current`, `body.previous` | `body.meta`, `body.data`, `body.previous` |
| Ações | `added`, `updated`, `deleted` | `create`, `change`, `delete` |
| Metadados | Limitados | Mais informações (correlation_id, attempt, etc.) |

---

## 🔄 Como o Código Processa

O código atual suporta **ambos os formatos** (v1 e v2) para compatibilidade:

### Para Webhooks v2:
- `body.meta.action` = `"create"`, `"change"`, ou `"delete"`
- `body.meta.entity` = `"person"`, `"deal"`, etc.
- `body.data` = dados atuais
- `body.previous` = dados anteriores

### Para Webhooks v1 (legado):
- `body.event` = `"added.person"`, `"updated.deal"`, etc.
- `body.current` = dados atuais
- `body.previous` = dados anteriores

---

## ✅ Status Codes Esperados

O Pipedrive espera:
- **2XX** - Sucesso (qualquer código 2XX é aceito)
- **500** - Erro do servidor (cliente)
- **Timeout** - Se exceder 10 segundos, será retentado

**Importante:** Retorne sempre um código 2XX (200, 201, 202) para sucesso!

---

## 🔁 Retry Logic

O Pipedrive tem uma política de retry:
1. **Primeira tentativa** - Imediata
2. **Retry 1** - Após 3 segundos
3. **Retry 2** - Após 30 segundos
4. **Retry 3** - Após 150 segundos

Se todas as tentativas falharem, o webhook será marcado como não entregue.

**Ban System:**
- Após 10 falhas na primeira tentativa, o webhook é banido por 30 minutos
- Se não houver entregas bem-sucedidas por 3 dias consecutivos, o webhook é deletado

---

## 🧪 Testando os Webhooks

### 1. Teste de Lead
1. Crie uma nova **Person** no Pipedrive
2. Verifique os logs no Vercel Dashboard
3. Verifique se um Lead foi criado no banco

### 2. Teste de Deal
1. Crie um **Deal** no Pipedrive
2. Mude o status para **"Won"**
3. Verifique os logs
4. Verifique se o processo de contrato/fatura foi iniciado

### 3. Verificar Logs

**Via Vercel:**
- Dashboard → Projeto → Functions → Logs

**Via Banco de Dados:**
```sql
SELECT * FROM "IntegrationLog" 
WHERE service = 'PIPEDRIVE' 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## 🔐 Segurança

### Autenticação HTTP (Opcional)

Você pode configurar autenticação HTTP básica:

```json
{
  "http_auth_user": "usuario",
  "http_auth_password": "senha_secreta"
}
```

### Validação de Assinatura (Recomendado)

Configure `PIPEDRIVE_WEBHOOK_SECRET` no `.env`:
```bash
PIPEDRIVE_WEBHOOK_SECRET="sua_string_secreta_aqui"
```

O código valida automaticamente o header `x-pipedrive-signature`.

---

## 📊 Limites

- **Máximo de 40 webhooks por usuário**
- **Timeout de 10 segundos** por requisição
- **Webhooks não contam para rate limit da API**

---

## 🚨 Troubleshooting

### Webhook não está sendo recebido

1. Verifique se a URL está correta e acessível
2. Teste a URL manualmente (deve retornar 2XX ou 400, não 404)
3. Verifique os logs no Vercel Dashboard
4. Verifique o status do webhook no Pipedrive (Configurações → Webhooks)

### Erro 401 (Unauthorized)

- Verifique se `PIPEDRIVE_WEBHOOK_SECRET` está configurado
- Verifique se o header `x-pipedrive-signature` está sendo enviado

### Erro 400 (Bad Request)

- Verifique se o payload contém os campos necessários
- Verifique os logs para ver qual campo está faltando
- Certifique-se de que o código está processando o formato v2 corretamente

### Webhook foi deletado

- Se não houver entregas bem-sucedidas por 3 dias, o Pipedrive deleta o webhook
- Recrie o webhook e verifique se a URL está funcionando

---

## 📚 Recursos

- [Documentação Oficial Webhooks v2](https://pipedrive.readme.io/docs/guide-for-webhooks-v2)
- [Lista de Webhooks v2 Disponíveis](https://pipedrive.readme.io/docs/list-of-webhooks-v2)
- [Guia de Migração v1 para v2](https://pipedrive.readme.io/docs/webhooks-v2-migration-guide)

---

**Última atualização:** Dezembro 2024  
**Versão do Webhook:** 2.0  
**Domínio:** `carreirausa.sigmaintel.io`






