# Digisac Activation — Design

**Data:** 2026-05-11
**Status:** Approved (brainstorming → writing-plans)
**Branch:** `feat/digisac-activation`

## Contexto

A integração com Digisac (WhatsApp operacional) já está **100% scaffolded e wireada** no codebase, mas nunca foi configurada por falta de token. O time obteve o token da Digisac e quer ativar a integração nos três ambientes (local, Vercel, Swarm).

**O que já existe (não muda neste trabalho):**

- `lib/services/digisac.service.ts` — config loader, `sendDigisacMessage`, `extractDigisacWebhookMessage`
- `lib/ops/digisac-store.ts` — threads + mensagens + auto-match telefone → enrollment ativo
- `app/api/ops/enrollments/[id]/digisac/route.ts` — GET histórico + POST envio (RBAC ADMIN/OPERATIONAL)
- `app/api/webhooks/digisac/route.ts` — recebimento de mensagens com validação de secret
- `OpsDigisacThread` + `OpsDigisacMessage` no Prisma + migration `20260501010000_add_ops_digisac_messages` já aplicada
- UI `DigisacWhatsappCard` em `app/ops/pipeline/PipelineBoard.tsx` (linha 378+) com input, lista de mensagens e link pro contato no painel Digisac
- Variáveis no `.env.example`: `DIGISAC_API_BASE_URL`, `DIGISAC_API_TOKEN`, `DIGISAC_SERVICE_ID`, `DIGISAC_WEBHOOK_SECRET`, `DIGISAC_WORKSPACE_URL`, `DIGISAC_DEFAULT_COUNTRY_CODE`

**O que falta:** configurar token nos 3 ambientes, cadastrar webhook no painel Digisac, e ter ferramentas de diagnóstico pra detectar token expirado/inválido sem precisar abrir o site e mandar mensagem.

## Objetivo

Adicionar **observabilidade e ferramenta de troubleshooting** para a integração Digisac, sem mexer no código já implementado. Permitir:

1. `GET /api/health` reportar status do Digisac (config presente + token válido)
2. `npm run test:digisac` validar config localmente e opcionalmente disparar mensagem de teste
3. Documentar URLs de webhook por ambiente e fluxo de troubleshooting

## Non-Goals

- Templates de mensagem pré-definidos (futuro)
- Fluxos automáticos disparados por eventos (futuro)
- Migrar `whatsapp.service.ts` (Twilio) para Digisac (futuro)
- Endpoint admin dedicado `/api/admin/digisac/diagnose` (overkill agora)
- UI de Settings → Integrations (não existe ainda)

## Arquitetura

Cinco mudanças, todas aditivas:

```
app/api/health/route.ts        ← adiciona bloco `digisac` (~20 LOC)
scripts/test-digisac.ts        ← novo arquivo (~80 LOC)
package.json                   ← novo script `test:digisac`
.env.example                   ← anota URLs de webhook por ambiente
docs/integrations/digisac.md   ← novo arquivo (~80 LOC, troubleshooting)
```

Não toca: nenhum arquivo em `lib/`, `app/api/webhooks/`, `app/api/ops/`, `app/ops/`, `prisma/`.

## Entregáveis

### 1. Bloco `digisac` no `/api/health`

Inserir após o bloco `qb_token` em `app/api/health/route.ts:60`, mantendo o padrão existente (try/catch, `checks.{name}`, atualizar `allOk`):

```ts
// --- Digisac ---
try {
  const config = getDigisacConfig();
  if (!config.enabled) {
    checks.digisac = { ok: false, detail: `Missing: ${config.missing.join(", ")}` };
    allOk = false;
  } else {
    const res = await fetch(`${config.apiBaseUrl}/services/${config.serviceId}`, {
      headers: { Authorization: `Bearer ${config.apiToken}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      checks.digisac = { ok: false, detail: `API ${res.status}` };
      allOk = false;
    } else {
      checks.digisac = { ok: true, detail: `service ${config.serviceId}` };
    }
  }
} catch (err) {
  checks.digisac = { ok: false, detail: err instanceof Error ? err.message : String(err) };
  allOk = false;
}
```

**Endpoint de ping:** `GET /services/{serviceId}` é a hipótese inicial — read-only, barata, valida `apiToken` + `serviceId` numa só chamada. Antes de mergear o PR, o smoke script (entregável 2) é executado contra a API real; se o endpoint correto for diferente (ex: `GET /services` lista, ou `GET /contacts?limit=1`), ajusta-se o health check antes do merge.

**Timeout:** 5 segundos, alinhado com o check de Redis. Falha gracefulmente em `503` se a Digisac estiver fora — não derruba os outros checks.

### 2. Smoke script `scripts/test-digisac.ts`

Espelha o padrão de `scripts/test-quickbooks.ts`. Roda standalone com `tsx` e usa o próprio `digisac.service.ts` pra reaproveitar `sendDigisacMessage` (sem reimplementar HTTP).

```ts
// scripts/test-digisac.ts
// Uso:
//   npm run test:digisac
//   npm run test:digisac -- --to=5511XXXXXXXXX --text="ping"

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { getDigisacConfig, sendDigisacMessage } from "@/lib/services/digisac.service";

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (const arg of argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function main() {
  const cfg = getDigisacConfig();
  console.log("\n=== Digisac Config ===");
  console.log(`API base:   ${cfg.apiBaseUrl ?? "<missing>"}`);
  console.log(`Token:      ${cfg.apiToken ? `${cfg.apiToken.slice(0, 6)}…` : "<missing>"}`);
  console.log(`Service ID: ${cfg.serviceId ?? "<missing>"}`);
  console.log(`Workspace:  ${cfg.workspaceUrl ?? "<derived>"}`);
  console.log(`Enabled:    ${cfg.enabled}`);

  if (!cfg.enabled) {
    console.error(`\n❌ Missing env vars: ${cfg.missing.join(", ")}`);
    process.exit(1);
  }

  console.log("\n=== Ping API ===");
  const res = await fetch(`${cfg.apiBaseUrl}/services/${cfg.serviceId}`, {
    headers: { Authorization: `Bearer ${cfg.apiToken}` },
  });
  const body = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(`Body:   ${body.slice(0, 300)}${body.length > 300 ? "…" : ""}`);
  if (!res.ok) {
    console.error("\n❌ Auth ou service ID inválido");
    process.exit(1);
  }
  console.log("✅ Auth OK");

  const args = parseArgs(process.argv);
  if (args.to && args.text) {
    console.log("\n=== Send Test Message ===");
    console.log(`To:   ${args.to}`);
    console.log(`Text: ${args.text}`);
    const result = await sendDigisacMessage({
      number: args.to,
      text: args.text,
      dontOpenTicket: true,
    });
    console.log("✅ Sent:", result);
  } else {
    console.log("\n(skip envio — passe --to=5511XXXXXXXXX --text=oi pra testar)");
  }
}

main().catch((err) => {
  console.error("\n❌ Falha:", err);
  process.exit(1);
});
```

**Por que `dontOpenTicket: true` no envio de teste:** evita criar ticket aberto no painel Digisac e poluir a inbox da equipe quando o operador estiver só validando config.

### 3. `package.json`

Adicionar à seção `scripts`:

```json
"test:digisac": "tsx scripts/test-digisac.ts"
```

(Padrão usado por `test:quickbooks` já existente.)

### 4. `.env.example`

Append ao bloco Digisac existente, depois da linha `DIGISAC_DEFAULT_COUNTRY_CODE="55"`:

```
# Webhook URL pra cadastrar no painel Digisac (Settings → Webhooks):
#   Local (ngrok):  https://<id>.ngrok.app/api/webhooks/digisac
#   Vercel preview: https://<branch>-<project>.vercel.app/api/webhooks/digisac
#   Produção:       https://app.carreirausa.com/api/webhooks/digisac
# Header de autenticação esperado pelo webhook — use UM destes (recomendado: Authorization Bearer):
#   Authorization: Bearer <DIGISAC_WEBHOOK_SECRET>   ← recomendado
#   x-digisac-secret: <DIGISAC_WEBHOOK_SECRET>
#   x-webhook-secret: <DIGISAC_WEBHOOK_SECRET>
#   x-api-key: <DIGISAC_WEBHOOK_SECRET>
```

(Os 4 headers vêm da implementação atual em `app/api/webhooks/digisac/route.ts:14`.)

### 5. `docs/integrations/digisac.md`

Novo arquivo. Seções:

1. **Visão geral** — pra que serve, em que parte da UI aparece
2. **Variáveis de ambiente** — tabela com nome, exemplo, descrição
3. **Onde configurar em cada ambiente** — local (`.env.local`), Vercel (`vercel env add`), Swarm (`ssh carreirausa` → editar `.env` → `docker service update --force`)
4. **Cadastrar webhook no painel Digisac** — URLs por ambiente, header de autenticação, payload esperado
5. **Comandos de diagnóstico** — `npm run test:digisac`, `curl /api/health | jq .checks.digisac`
6. **Como funciona o auto-match telefone → enrollment** — ponteiro pra `lib/ops/digisac-store.ts:17-36` explicando que o webhook tenta achar customer por telefone (com tolerância a DDI 55 e variações) e linka no enrollment ACTIVE mais recente
7. **Troubleshooting**
   - `401` no health check → token revogado ou expirado
   - `404` → `DIGISAC_SERVICE_ID` errado
   - Webhook recebe mas mensagem não aparece no card → telefone do aluno não confere; checar `IntegrationLog` com `service=DIGISAC action=WEBHOOK_IGNORED`
   - Envio retorna `503 Digisac nao configurado` → faltou env var (ver `checks.digisac.detail`)

## Plano de rollout

1. **PR mergeado** sem tocar config (zero risco — o código já está em `main`, só estamos adicionando health/smoke/docs)
2. **Local:** preencher `DIGISAC_*` em `.env.local` → `npm run test:digisac` → confirmar `✅ Auth OK`
3. **Vercel:**
   - `vercel env add DIGISAC_API_BASE_URL` (preview + production)
   - Repetir pra `DIGISAC_API_TOKEN`, `DIGISAC_SERVICE_ID`, `DIGISAC_WEBHOOK_SECRET`
   - Trigger redeploy: `vercel --prod` ou push do merge commit (env vars não propagam pra deploys existentes)
   - `curl https://app.carreirausa.com/api/health | jq .checks.digisac` → `ok: true`
4. **Swarm:**
   - `ssh carreirausa`
   - Editar `.env` no diretório da stack
   - `docker service update --force --with-registry-auth <service>`
   - `curl https://app.carreirausa.com/api/health | jq .checks.digisac` → `ok: true`
5. **Painel Digisac:** cadastrar webhook nas 3 URLs (mesmo secret), header `Authorization: Bearer <secret>`
6. **Teste end-to-end:**
   - Abrir um card no PipelineBoard com aluno que tem telefone cadastrado
   - Enviar mensagem pelo `DigisacWhatsappCard`
   - Confirmar entrega no painel Digisac
   - Responder do celular do aluno
   - Confirmar que a resposta aparece no card (passou pelo webhook → `storeInboundDigisacWebhookMessage` → auto-link no enrollment)
7. Validar `IntegrationLog` em `npx prisma studio` filtrando `service=DIGISAC` — deve ter `OPS_MESSAGE_SENT` SUCCESS e `WEBHOOK_MESSAGE_RECEIVED` SUCCESS

## Riscos e mitigação

- **Endpoint de ping pode não existir** (`GET /services/{id}`) — o smoke script é executado antes do merge; se a Digisac retornar 404 nessa rota, troca-se para `GET /services` (lista) ou `GET /contacts?limit=1` no health check e no smoke
- **Health check ficando lento** se a API Digisac estiver instável — mitigado pelo `AbortSignal.timeout(5000)` (mesmo padrão do Redis)
- **Token vazado em log** — o smoke script imprime só `token.slice(0, 6)`; o service não loga token; health check não inclui token no `detail`
- **Webhook secret divergente entre ambientes** — usar o mesmo `DIGISAC_WEBHOOK_SECRET` nos 3 ambientes pra simplificar (a Digisac dispara o mesmo header pros 3 webhooks, mas cada ambiente tem seu próprio secret no env — então OK ter secrets diferentes; o doc registra essa decisão)

## Testes

Não há suite de unit tests para services no projeto. Validação se dá por:

- **Smoke script** — teste manual end-to-end antes do merge e antes de cada rollout
- **`/api/health`** — monitoramento contínuo em produção (já existe digest diário via Telegram bot conforme memory `project_ops_workflow`)
- **`IntegrationLog`** — auditoria por dentro do Prisma Studio

## Sucesso

PR mergeado, depois `curl /api/health` retornando `digisac.ok: true` nos 3 ambientes, e o ciclo "mensagem do card → recebida no celular → resposta do celular → aparece no card" funcionando.
