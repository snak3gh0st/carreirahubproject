# Digisac Integration

WhatsApp operacional para o Hub Operacional. Mensagens trocadas com alunos aparecem no `DigisacWhatsappCard` dentro do card do pipeline (`app/ops/pipeline/PipelineBoard.tsx:378`). Resposta do aluno chega via webhook e é auto-lincada ao enrollment ACTIVE mais recente daquele telefone.

## Variáveis de ambiente

| Variável | Exemplo | Descrição |
|---|---|---|
| `DIGISAC_API_BASE_URL` | `https://carreirausa.digisac.co/api/v1` | URL base da API REST do Digisac. Não inclua barra no final. |
| `DIGISAC_API_TOKEN` | Token pessoal gerado em **Meus dados → Tokens de acesso pessoal** | Bearer token de acesso à API. |
| `DIGISAC_SERVICE_ID` | UUID de uma conexão WhatsApp | ID do service (canal WhatsApp) que envia as mensagens. Visível em **Configurações → Conexões** ou via `GET /api/v1/services`. |
| `DIGISAC_WEBHOOK_SECRET` | `<random>` | Validado pelo nosso webhook handler. **Digisac não envia secret automaticamente** — é incluído como query param `?secret=...` na URL cadastrada (ver seção Webhook). |
| `DIGISAC_WORKSPACE_URL` | `https://carreirausa.digisac.co` | Opcional. Usado pra montar link "abrir no Digisac" no card. Default: deriva de `DIGISAC_API_BASE_URL`. |
| `DIGISAC_DEFAULT_COUNTRY_CODE` | `55` | DDI default pra prefixar números sem código de país. |

## Configurar em cada ambiente

### Local
```bash
# .env.local
DIGISAC_API_BASE_URL="https://carreirausa.digisac.co/api/v1"
DIGISAC_API_TOKEN="..."                 # Meus dados → Tokens de acesso pessoal
DIGISAC_SERVICE_ID="..."                # UUID de uma conexão WhatsApp ativa
DIGISAC_WEBHOOK_SECRET="$(openssl rand -hex 32)"   # qualquer string random
```

Validar:
```bash
npm run test:digisac
curl -s http://localhost:3000/api/health | jq '.checks.digisac'
```

### Produção antiga Vercel (desativado)

Não cadastrar novos webhooks no domínio antigo da Vercel. Produção canônica roda no Swarm em `https://app.carreirausa.com`.

### Swarm (`ssh carreirausa`)
```bash
ssh carreirausa
cd <diretório da stack>
nano .env   # adicionar/editar as 4 variáveis
docker service update --force --with-registry-auth <nome-do-service>
```

Validar:
```bash
curl -s https://app.carreirausa.com/api/health | jq '.checks.digisac'
```

Esperado: `{ "ok": true, "detail": "service <id>" }`.

## Cadastrar webhook no painel Digisac

> **Importante:** a Digisac não envia secret no header de webhook nem suporta HMAC. Pra evitar
> que qualquer pessoa que descubra a URL injete mensagens fake, **incluímos o secret como query
> param na própria URL** — `…?secret=<DIGISAC_WEBHOOK_SECRET>`. Nosso handler valida esse param.
> Se preferir cadastrar via API, ver "Cadastrar via API REST" abaixo.

### Pelo painel

1. Painel Digisac → **Meus dados** → **Webhooks** → **Criar webhook**
2. Nome: `carreirahub-<ambiente>` (ex `carreirahub-prod`)
3. URL — sempre com `?secret=$DIGISAC_WEBHOOK_SECRET` no final:
   - Local (com ngrok): `https://<id>.ngrok.app/api/webhooks/digisac?secret=$DIGISAC_WEBHOOK_SECRET`
   - Produção: `https://app.carreirausa.com/api/webhooks/digisac?secret=$DIGISAC_WEBHOOK_SECRET`
4. Eventos: marcar **`message.created`** (essencial — entrega novas mensagens). Opcional: `message.updated` (status de entrega/leitura).
5. Salvar. Disparar teste pelo próprio painel e confirmar HTTP `200 OK`.

### Cadastrar via API REST (alternativa)

```bash
curl -X POST "$DIGISAC_API_BASE_URL/me/webhooks" \
  -H "Authorization: Bearer $DIGISAC_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "active": true,
    "name": "carreirahub-prod",
    "url": "https://app.carreirausa.com/api/webhooks/digisac?secret='"$DIGISAC_WEBHOOK_SECRET"'",
    "events": ["message.created"],
    "type": "general"
  }'
```

Listar webhooks existentes: `curl -H "Authorization: Bearer $DIGISAC_API_TOKEN" "$DIGISAC_API_BASE_URL/me/webhooks"`

## Comandos de diagnóstico

| Comando | O que faz |
|---|---|
| `npm run test:digisac` | Valida config local + pinga `GET /services/{id}` |
| `npm run test:digisac -- --to=5511XXXXXXXXX --text="ping"` | Envia mensagem real com `dontOpenTicket=true` |
| `curl /api/health \| jq .checks.digisac` | Health check em qualquer ambiente |
| `npx prisma studio` → tabela `IntegrationLog` filtrar `service=DIGISAC` | Auditoria de webhooks e envios |

## Como funciona o auto-match telefone → enrollment

Quando o webhook recebe uma mensagem inbound, `storeInboundDigisacWebhookMessage` (`lib/ops/digisac-store.ts:162`) tenta linkar o thread a um enrollment seguindo essa cadeia:

1. Normaliza o telefone removendo tudo que não é dígito
2. Procura `Customer` por telefone — tolera 3 variações: dígitos exatos, sem DDI 55, e sufixo dos últimos 10 dígitos (`lib/ops/digisac-store.ts:17`)
3. Se achou customer, procura `MentorshipEnrollment` com status `ACTIVE` mais recente (`lib/ops/digisac-store.ts:38`)
4. Se achou enrollment, linka o thread; se não, o thread fica "órfão" (sem `customerId`/`enrollmentId`) e não aparece em nenhum card

Resultado: mensagem do aluno só aparece no card se o telefone do `Customer` bater com algum formato. Se não, ver `IntegrationLog action=WEBHOOK_MESSAGE_RECEIVED` — o webhook gravou a mensagem, mas o thread ficou desconectado.

## Troubleshooting

| Sintoma | Causa provável | Como confirmar |
|---|---|---|
| `/api/health` → `digisac.ok: false detail: "Missing: ..."` | Env var faltando | Olhar quais vars estão na mensagem |
| `/api/health` → `digisac.ok: false detail: "API 401"` | Token revogado ou expirado | Renovar token no painel Digisac, atualizar env, redeploy |
| `/api/health` → `digisac.ok: false detail: "API 404"` | `DIGISAC_SERVICE_ID` errado | `curl -H "Authorization: Bearer $DIGISAC_API_TOKEN" "$DIGISAC_API_BASE_URL/services"` lista os service IDs disponíveis |
| Envio do card retorna `503 Digisac nao configurado` | App em prod sem env var | Mesma checagem do health, e redeploy se acabou de configurar |
| Resposta do aluno não aparece no card | Telefone do Customer não bate com o do WhatsApp | `IntegrationLog` filtrar `service=DIGISAC action=WEBHOOK_MESSAGE_RECEIVED`. Se a mensagem foi gravada, é o auto-match; ajustar `Customer.phone` |
| Webhook retorna 401 | Query param `?secret=` na URL cadastrada não bate com `DIGISAC_WEBHOOK_SECRET` do ambiente | Comparar `?secret=` da URL no painel Digisac com o env var ativo no servidor |
| Mensagem enviada não chega no celular | Service ID errado ou número fora do canal | `npm run test:digisac --to=<num> --text=oi` e ler o response body |
