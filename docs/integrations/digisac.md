# Digisac Integration

WhatsApp operacional para o Hub Operacional. Mensagens trocadas com alunos aparecem no `DigisacWhatsappCard` dentro do card do pipeline (`app/ops/pipeline/PipelineBoard.tsx:378`). Resposta do aluno chega via webhook e é auto-lincada ao enrollment ACTIVE mais recente daquele telefone.

## Variáveis de ambiente

| Variável | Exemplo | Descrição |
|---|---|---|
| `DIGISAC_API_BASE_URL` | `https://suaempresa.digisac.me/api/v1` | URL base da API REST do Digisac. Não inclua barra no final. |
| `DIGISAC_API_TOKEN` | `eyJhbGc...` | Bearer token de acesso à API. |
| `DIGISAC_SERVICE_ID` | `srv_abc123` | ID do service (canal WhatsApp) que envia as mensagens. |
| `DIGISAC_WEBHOOK_SECRET` | `<random>` | Segredo enviado pelo Digisac no header de cada webhook. Use o mesmo nos 3 ambientes se for prático, ou um por ambiente. |
| `DIGISAC_WORKSPACE_URL` | `https://suaempresa.digisac.me` | Opcional. Usado pra montar link "abrir no Digisac" no card. Default: deriva de `DIGISAC_API_BASE_URL`. |
| `DIGISAC_DEFAULT_COUNTRY_CODE` | `55` | DDI default pra prefixar números sem código de país. |

## Configurar em cada ambiente

### Local
```bash
# .env.local
DIGISAC_API_BASE_URL="https://suaempresa.digisac.me/api/v1"
DIGISAC_API_TOKEN="..."
DIGISAC_SERVICE_ID="..."
DIGISAC_WEBHOOK_SECRET="..."
```

Validar:
```bash
npm run test:digisac
```

### Vercel
```bash
# Repetir pra cada ambiente alvo (preview e production):
for var in DIGISAC_API_BASE_URL DIGISAC_API_TOKEN DIGISAC_SERVICE_ID DIGISAC_WEBHOOK_SECRET; do
  vercel env add "$var" preview
  vercel env add "$var" production
done
```

Env vars não propagam pra deploys existentes — trigger um redeploy:
```bash
vercel --prod
# ou push do merge commit pra rodar o build automático
```

Validar:
```bash
curl -s https://carreirausa.sigmaintel.io/api/health | jq '.checks.digisac'
# esperado: { "ok": true, "detail": "service <id>" }
```

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

## Cadastrar webhook no painel Digisac

1. Painel Digisac → **Settings** → **Webhooks** → **Add**
2. URL:
   - Local (com ngrok): `https://<id>.ngrok.app/api/webhooks/digisac`
   - Vercel prod: `https://carreirausa.sigmaintel.io/api/webhooks/digisac`
   - Swarm prod: `https://app.carreirausa.com/api/webhooks/digisac`
3. Eventos: subscrever pelo menos `message.received` (e `message.sent` se quiser auditoria de eco)
4. Header de autenticação: adicionar `Authorization: Bearer <DIGISAC_WEBHOOK_SECRET>`
   - Aceita também: `x-digisac-secret`, `x-webhook-secret`, `x-api-key`
5. Salvar e disparar teste pelo próprio painel — confirmar `200 OK`

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
| `/api/health` → `digisac.ok: false detail: "API 404"` | `DIGISAC_SERVICE_ID` errado | `npm run test:digisac` e ler o body; pode ser necessário trocar `/services/{id}` por `/services` no health check |
| Envio do card retorna `503 Digisac nao configurado` | App em prod sem env var | Mesma checagem do health, e redeploy se acabou de configurar |
| Resposta do aluno não aparece no card | Telefone do Customer não bate com o do WhatsApp | `IntegrationLog` filtrar `service=DIGISAC action=WEBHOOK_MESSAGE_RECEIVED`. Se a mensagem foi gravada, é o auto-match; ajustar `Customer.phone` |
| Webhook retorna 401 | `DIGISAC_WEBHOOK_SECRET` divergente | Comparar valor no painel Digisac vs `.env` do ambiente |
| Mensagem enviada não chega no celular | Service ID errado ou número fora do canal | `npm run test:digisac --to=<num> --text=oi` e ler o response body |
