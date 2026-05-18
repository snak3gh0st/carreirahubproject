# 🔗 URLs dos Webhooks - Referência Rápida

## 🚀 Produção (Swarm)

### Webhook de Leads
```
https://app.carreirausa.com/api/webhooks/pipedrive/lead
```

**Configuração no Pipedrive (Webhooks v2):**
- **Ação do evento:** `create`
- **Objeto do evento:** `person`
- **Nível de permissão:** Seu usuário

---

### Webhook de Deals
```
https://app.carreirausa.com/api/webhooks/pipedrive/deal
```

**Configuração no Pipedrive (Webhooks v2):**
- **Ação do evento:** `change`
- **Objeto do evento:** `deal`
- **Nível de permissão:** Seu usuário

---

## 📍 Como Configurar

1. Acesse: **Pipedrive** → **Configurações** → **Integrações** → **Webhooks**
2. Clique em **Criar novo webhook**
3. Configure os eventos conforme acima
4. Cole a URL correspondente no campo **URL do Ponto de Extremidade**
5. Salve

---

## ✅ Teste Rápido

Após configurar, teste criando:
- Uma nova **Person** no Pipedrive (testa webhook de leads)
- Um **Deal** e mude o status para **Won** (testa webhook de deals)

Verifique os logs no host Swarm (`ssh carreirausa`) e os registros em `IntegrationLog`.

---

**Domínio:** `app.carreirausa.com`  
**Plataforma:** Docker Swarm (`carreirausa`)
