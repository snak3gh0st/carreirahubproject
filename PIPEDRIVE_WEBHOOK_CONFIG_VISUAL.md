# 🎯 Configuração Visual dos Webhooks - Pipedrive (Webhooks v2)

> 📘 **Baseado na documentação oficial:** [Pipedrive Webhooks v2 Guide](https://pipedrive.readme.io/docs/guide-for-webhooks-v2)

## 📸 Webhook 1: Novos Leads (Persons)

### Seção: "Eventos no Pipedrive"

**1. Ação do evento (required) ⓘ:**
- Selecione: `create` (Criar)
- **Nota:** Na documentação v2, use `create` ao invés de `added`

**2. Objeto do evento (required) ⓘ:**
- Selecione: `person` (Pessoa)

**3. Nível de permissão do usuário (required) ⓘ:**
- Selecione: `person` (ou `*` se quiser todos os níveis)
- **Nota:** O `*` significa "todos os níveis", mas é mais seguro usar `person` especificamente

### Seção: "Ponto de extremidade fora do Pipedrive"

**1. Nome do webhook:**
- Digite: `Carreira AI Hub - Novos Leads`

**2. URL do Ponto de Extremidade (required) ⓘ:**
- Cole: `https://carreirausa.sigmaintel.io/api/webhooks/pipedrive/lead`

**3. Nome de usuário autent. HTTP:**
- Deixe em branco (ou configure se usar autenticação HTTP)

**4. Senha autent. HTTP:**
- Deixe em branco (ou configure se usar autenticação HTTP)

---

## 📸 Webhook 2: Deals Ganhos (Won)

### Seção: "Eventos no Pipedrive"

**1. Ação do evento (required) ⓘ:**
- Selecione: `change` (Alterar)
- **Nota:** Na documentação v2, use `change` ao invés de `updated`

**2. Objeto do evento (required) ⓘ:**
- Selecione: `deal` (Negócio)

**3. Nível de permissão do usuário (required) ⓘ:**
- Selecione: `deal` (ou `*` se quiser todos os níveis)

### Seção: "Ponto de extremidade fora do Pipedrive"

**1. Nome do webhook:**
- Digite: `Carreira AI Hub - Deals Ganhos`

**2. URL do Ponto de Extremidade (required) ⓘ:**
- Cole: `https://carreirausa.sigmaintel.io/api/webhooks/pipedrive/deal`

**3. Nome de usuário autent. HTTP:**
- Deixe em branco

**4. Senha autent. HTTP:**
- Deixe em branco

---

## 🔍 Sobre o Campo "Nível de permissão do usuário"

Este campo parece controlar em qual nível hierárquico o webhook deve monitorar eventos. As opções disponíveis são:

- `*` - Todos os níveis (mais genérico)
- `activity` - Atividades
- `deal` - Negócios
- `lead` - Leads
- `note` - Notas
- `organization` - Organizações
- `person` - Pessoas
- `pipeline` - Pipelines
- `product` - Produtos
- `stage` - Estágios
- `user` - Usuários

**Recomendação:**
- Para webhook de **Leads**: Use `person`
- Para webhook de **Deals**: Use `deal`

Isso garante que você receba apenas os eventos relevantes para cada tipo de webhook.

---

## ✅ Checklist de Preenchimento

### Webhook 1 - Leads
- [ ] Ação: `create` (Webhooks v2)
- [ ] Objeto: `person`
- [ ] Nível: `person`
- [ ] Nome: `Carreira AI Hub - Novos Leads`
- [ ] URL: `https://carreirausa.sigmaintel.io/api/webhooks/pipedrive/lead`
- [ ] Autenticação: Deixar em branco

### Webhook 2 - Deals
- [ ] Ação: `change` (Webhooks v2)
- [ ] Objeto: `deal`
- [ ] Nível: `deal`
- [ ] Nome: `Carreira AI Hub - Deals Ganhos`
- [ ] URL: `https://carreirausa.sigmaintel.io/api/webhooks/pipedrive/deal`
- [ ] Autenticação: Deixar em branco

---

## 🚨 Problemas Comuns

### O campo "Ação do evento" mostra apenas `*`
- Isso pode ser um placeholder. Tente clicar no campo e verificar se há outras opções como `added`, `updated`, `deleted`
- Se não aparecer, tente selecionar primeiro o "Objeto do evento" e depois a "Ação"

### Não consigo encontrar a opção `person` ou `deal`
- Certifique-se de que está selecionando no campo correto:
  - "Objeto do evento" = `person` ou `deal`
  - "Nível de permissão" = `person` ou `deal` (ou `*`)

### A URL não está sendo aceita
- Certifique-se de que a URL começa com `https://`
- Verifique se não há espaços antes ou depois da URL
- Teste a URL manualmente no navegador (deve retornar um erro 400 ou 405, não 404)

---

**Última atualização:** Dezembro 2024

