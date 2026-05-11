# Digisac Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add observability and a smoke-test CLI for the already-implemented Digisac WhatsApp integration so the team can activate the token in three environments (local, Vercel, Swarm) with confidence.

**Architecture:** Five additive changes only — no existing file is modified beyond adding new content. A new bloco `digisac` in `/api/health` validates token + service ID with a 5s timeout against Digisac's REST API. A new `scripts/test-digisac.ts` reuses `sendDigisacMessage` from the existing service for a CLI smoke check and optional message send. `.env.example` gains webhook URL annotations. A new `docs/integrations/digisac.md` covers configuration, webhook setup, and troubleshooting.

**Tech Stack:** Next.js 14 App Router, TypeScript, `tsx` for script execution, `dotenv` for env loading in scripts. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-11-digisac-activation-design.md`

**Branch:** `feat/digisac-activation` (already created and contains the spec)

---

## Pre-flight

- [ ] **Confirm branch**

Run: `git branch --show-current`
Expected: `feat/digisac-activation`

- [ ] **Confirm working tree clean**

Run: `git status --short`
Expected: empty output (the spec is already committed)

---

## Task 1: Smoke script `scripts/test-digisac.ts`

**Files:**
- Create: `scripts/test-digisac.ts`

This script is intentionally standalone — it imports `getDigisacConfig` and `sendDigisacMessage` from the existing service via relative paths (the same pattern as `scripts/test-pipedrive.ts` and `scripts/test-quickbooks.ts`, because the `tsconfig.json` `include` excludes `scripts/`). It loads `.env.local` and `.env` via `dotenv` and runs through three checks: config presence, API ping, and optional message send.

- [ ] **Step 1: Create the file**

Create `scripts/test-digisac.ts` with this exact content:

```ts
/**
 * Smoke test for Digisac integration.
 *
 * Usage:
 *   npm run test:digisac
 *   npm run test:digisac -- --to=5511XXXXXXXXX --text="ping"
 *
 * Loads .env.local then .env, validates config, pings the Digisac API
 * read-only to verify the token, and optionally sends a real test message
 * when --to and --text are provided. Test messages use dontOpenTicket=true
 * so they don't pollute the support inbox.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { getDigisacConfig, sendDigisacMessage } from "../lib/services/digisac.service";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

async function main(): Promise<void> {
  const cfg = getDigisacConfig();

  console.log("\n=== Digisac Config ===");
  console.log(`API base:   ${cfg.apiBaseUrl ?? "<missing>"}`);
  console.log(`Token:      ${cfg.apiToken ? `${cfg.apiToken.slice(0, 6)}…` : "<missing>"}`);
  console.log(`Service ID: ${cfg.serviceId ?? "<missing>"}`);
  console.log(`Workspace:  ${cfg.workspaceUrl ?? "<derived>"}`);
  console.log(`Country:    ${cfg.defaultCountryCode}`);
  console.log(`Enabled:    ${cfg.enabled}`);

  if (!cfg.enabled) {
    console.error(`\n❌ Missing env vars: ${cfg.missing.join(", ")}`);
    process.exit(1);
  }

  console.log("\n=== Ping API ===");
  const pingUrl = `${cfg.apiBaseUrl}/services/${cfg.serviceId}`;
  console.log(`GET ${pingUrl}`);
  const res = await fetch(pingUrl, {
    headers: { Authorization: `Bearer ${cfg.apiToken}` },
  });
  const body = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(`Body:   ${body.slice(0, 300)}${body.length > 300 ? "…" : ""}`);

  if (!res.ok) {
    console.error("\n❌ Auth failed or service ID is wrong. If 404, try GET /services (list) to find the correct service ID.");
    process.exit(1);
  }
  console.log("\n✅ Auth OK");

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
    console.log("\n✅ Sent:");
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("\n(skip envio — passe --to=5511XXXXXXXXX --text=oi pra testar envio real)");
  }
}

main().catch((err) => {
  console.error("\n❌ Falha:", err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
```

- [ ] **Step 2: Run script with empty config to verify failure path**

The `scripts/` directory is excluded from `tsconfig.json` `include`, matching the convention of every other `scripts/test-*.ts` in the repo. We rely on `tsx` to parse/transpile at runtime — a syntax error would surface immediately on first invocation.

Without setting any `DIGISAC_*` env var (use a throwaway shell), run:
```bash
env -i PATH="$PATH" HOME="$HOME" npx tsx scripts/test-digisac.ts
```
Expected output contains:
```
API base:   <missing>
Token:      <missing>
Service ID: <missing>
Enabled:    false

❌ Missing env vars: DIGISAC_API_BASE_URL, DIGISAC_API_TOKEN, DIGISAC_SERVICE_ID
```
Exit code: `1`.

- [ ] **Step 3: Commit**

```bash
git add scripts/test-digisac.ts
git commit -m "$(cat <<'EOF'
feat(ops): add Digisac smoke test script

scripts/test-digisac.ts validates DIGISAC_* env vars, pings GET
/services/{id} read-only to verify the token, and optionally sends a
real test message when --to and --text are passed (uses dontOpenTicket
to avoid polluting the support inbox). Mirrors the pattern of
test-pipedrive.ts and test-quickbooks.ts — standalone, dotenv-loaded,
relative imports because tsconfig excludes scripts/.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `package.json` script entry

**Files:**
- Modify: `package.json` (scripts section)

- [ ] **Step 1: Read current scripts section**

Run: `grep -n '"test:' package.json`
Expected: lines like `"test:quickbooks": "npx tsx scripts/test-quickbooks.ts"` and similar.

- [ ] **Step 2: Add `test:digisac` entry**

Edit `package.json` and add this line in the `scripts` object, alphabetically next to `test:docusign` and `test:quickbooks`:

```json
"test:digisac": "npx tsx scripts/test-digisac.ts",
```

Use Edit tool with `old_string` set to the line immediately above where the new entry goes (e.g., the `test:docusign` line) and include both lines in `new_string` to keep the position deterministic. Match the existing trailing comma style.

- [ ] **Step 3: Verify JSON is valid**

Run: `node -e "require('./package.json')"`
Expected: no output (no parse error).

- [ ] **Step 4: Run the new script via npm to confirm wiring**

In a shell without `DIGISAC_*` env vars set:
```bash
npm run test:digisac
```
Expected: same output as Task 1 Step 2 — `❌ Missing env vars` and exit code 1. (npm exits with the same code.)

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "$(cat <<'EOF'
chore(scripts): add test:digisac npm script

Wires scripts/test-digisac.ts behind `npm run test:digisac`, following
the existing test:quickbooks / test:pipedrive convention.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Health check bloco `digisac`

**Files:**
- Modify: `app/api/health/route.ts:60` (insert after the existing `qb_token` block)

- [ ] **Step 1: Re-read current health route to confirm insertion point**

Read `app/api/health/route.ts` and confirm:
- The `qb_token` block ends around line 60 with `}`
- The next non-empty line is `const status = allOk ? 200 : 503;`

If line numbers differ, adjust the insertion point accordingly — anchor on the closing brace of the `qb_token` try/catch and the `const status` line, not the exact line number.

- [ ] **Step 2: Add import for `getDigisacConfig`**

At the top of `app/api/health/route.ts`, add this import alongside the existing imports:

```ts
import { getDigisacConfig } from "@/lib/services/digisac.service";
```

The existing imports already use the `@/` alias (`@/lib/db`), so this matches the file's convention.

- [ ] **Step 3: Insert the `digisac` check block**

Insert this block between the closing brace of the `qb_token` try/catch and the `const status = allOk ? 200 : 503;` line:

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

Indentation: two spaces, matching the existing blocks.

- [ ] **Step 4: Verify TypeScript and lint**

Run: `npm run lint`
Expected: no new errors mentioning `app/api/health/route.ts` (pre-existing warnings elsewhere are fine).

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: same — no new errors in `app/api/health/route.ts`.

- [ ] **Step 5: Verify the failure path locally (no Digisac env set)**

Start the dev server (in a separate shell, so it stays running):
```bash
npm run dev
```

In another shell, with `DIGISAC_*` unset in `.env.local`:
```bash
curl -s http://localhost:3000/api/health | jq '.checks.digisac'
```
Expected:
```json
{
  "ok": false,
  "detail": "Missing: DIGISAC_API_BASE_URL, DIGISAC_API_TOKEN, DIGISAC_SERVICE_ID"
}
```

Also verify the overall response code:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/health
```
Expected: `503` (since one check fails, `allOk` is false).

Stop the dev server (`Ctrl+C`) when done.

- [ ] **Step 6: Commit**

```bash
git add app/api/health/route.ts
git commit -m "$(cat <<'EOF'
feat(monitoring): add Digisac check to /api/health

New bloco validates DIGISAC_* config presence and pings GET
/services/{id} with a 5s AbortSignal timeout to confirm the token is
live. Failure modes are surfaced via checks.digisac.detail:
- "Missing: ..." when env vars are absent
- "API 401" / "API 404" when the API rejects the request
- network errors when the API is unreachable

Mirrors the existing qb_token check pattern. The endpoint
GET /services/{id} is the working hypothesis; if the smoke script
discovers a different endpoint shape during rollout, this block is
adjusted in a follow-up.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `.env.example` webhook annotations

**Files:**
- Modify: `.env.example` (Digisac section)

- [ ] **Step 1: Locate the Digisac block**

Run: `grep -n "DIGISAC" .env.example`
Expected: the existing Digisac block, ending with `DIGISAC_DEFAULT_COUNTRY_CODE="55"  # ...`

- [ ] **Step 2: Append webhook URL annotations**

Use Edit tool to insert this block immediately after the `DIGISAC_DEFAULT_COUNTRY_CODE="55"` line. The `old_string` should match that whole line; `new_string` should be that line followed by the new comment block:

```
DIGISAC_DEFAULT_COUNTRY_CODE="55"  # Usado quando o telefone do aluno nao tem DDI

# Webhook URL pra cadastrar no painel Digisac (Settings → Webhooks → Add):
#   Local (ngrok):  https://<id>.ngrok.app/api/webhooks/digisac
#   Vercel preview: https://<branch>-<project>.vercel.app/api/webhooks/digisac
#   Vercel prod:    https://carreirausa.sigmaintel.io/api/webhooks/digisac
#   Swarm prod:     https://app.carreirausa.com/api/webhooks/digisac
# Header de autenticação esperado pelo webhook — use UM destes:
#   Authorization: Bearer <DIGISAC_WEBHOOK_SECRET>   ← recomendado
#   x-digisac-secret: <DIGISAC_WEBHOOK_SECRET>
#   x-webhook-secret: <DIGISAC_WEBHOOK_SECRET>
#   x-api-key: <DIGISAC_WEBHOOK_SECRET>
```

(Preserve the trailing comment on the `DIGISAC_DEFAULT_COUNTRY_CODE` line exactly as it appears — the actual text after `#` may differ slightly from what's shown above; check the file and keep it verbatim.)

- [ ] **Step 3: Verify with diff**

Run: `git diff .env.example`
Expected: clean addition of ~10 commented lines after the country code variable. No other changes.

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "$(cat <<'EOF'
docs(env): annotate Digisac webhook URLs and auth headers

Adds inline comments listing the webhook URL per environment (local
ngrok / Vercel preview / Vercel prod / Swarm prod) and the four
auth header shapes accepted by app/api/webhooks/digisac/route.ts,
flagging Authorization: Bearer as recommended.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Integration documentation

**Files:**
- Create: `docs/integrations/digisac.md`

- [ ] **Step 1: Confirm parent directory**

Run: `ls docs/integrations/ 2>/dev/null || mkdir -p docs/integrations && ls docs/integrations/`
Expected: directory exists (created if needed). No other files required.

- [ ] **Step 2: Create the doc file**

Create `docs/integrations/digisac.md` with this exact content:

````markdown
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
````

- [ ] **Step 3: Verify markdown renders without syntax issues**

Run: `head -20 docs/integrations/digisac.md`
Expected: clean markdown — title, paragraph, table header. No literal backslashes from escape sequences in the rendered file.

- [ ] **Step 4: Commit**

```bash
git add docs/integrations/digisac.md
git commit -m "$(cat <<'EOF'
docs(integrations): add Digisac integration guide

Covers env vars, configuration per environment (local / Vercel /
Swarm), webhook setup in the Digisac panel, diagnostic commands,
the auto-match phone → enrollment logic in digisac-store.ts, and a
troubleshooting matrix for the most common failure modes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Final verification and push

- [ ] **Step 1: Confirm all six commits are present**

Run: `git log --oneline main..HEAD`
Expected: 6 commits total (1 spec committed before this plan + 5 from this plan):
```
<hash> docs(integrations): add Digisac integration guide
<hash> docs(env): annotate Digisac webhook URLs and auth headers
<hash> feat(monitoring): add Digisac check to /api/health
<hash> chore(scripts): add test:digisac npm script
<hash> feat(ops): add Digisac smoke test script
<hash> docs: design spec for Digisac activation
```

- [ ] **Step 2: Run full lint**

Run: `npm run lint`
Expected: no new errors. Compare against `main` baseline if pre-existing warnings exist:
```bash
git stash && npm run lint > /tmp/lint-main.txt 2>&1; git stash pop
npm run lint > /tmp/lint-branch.txt 2>&1
diff /tmp/lint-main.txt /tmp/lint-branch.txt
```
Expected: empty diff or only the new file paths.

- [ ] **Step 3: Run full typecheck**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: same baseline as `main` — no new errors. (Scripts are excluded from `tsconfig.json` `include`, so the smoke script isn't covered by this check; it gets exercised end-to-end in Task 1 Step 2.)

- [ ] **Step 4: Confirm working tree clean**

Run: `git status --short`
Expected: empty.

- [ ] **Step 5: Push branch**

```bash
git push -u origin feat/digisac-activation
```
Expected: branch created on remote, no pre-receive hook errors.

- [ ] **Step 6: Open PR**

```bash
gh pr create --title "feat(ops): activate Digisac integration (health + smoke + docs)" --body "$(cat <<'EOF'
## Summary
- Adds `checks.digisac` to `/api/health` (validates env presence + pings `GET /services/{id}` with a 5s timeout).
- Adds `scripts/test-digisac.ts` (`npm run test:digisac`) for local config validation and optional real-message sends.
- Annotates `.env.example` with webhook URLs per environment and accepted auth headers.
- Adds `docs/integrations/digisac.md` with config, webhook setup, auto-match logic, and troubleshooting.
- **No changes to existing service / store / endpoints / Prisma / UI** — the integration was already fully scaffolded; this PR only adds observability and docs so the team can roll out the token.

## Spec
`docs/superpowers/specs/2026-05-11-digisac-activation-design.md`

## Test plan
- [ ] `npm run lint` clean (vs `main` baseline)
- [ ] `npx tsc -p tsconfig.json --noEmit` clean (vs `main` baseline)
- [ ] `npm run test:digisac` (no env) → exits 1 with `Missing env vars`
- [ ] `curl /api/health | jq .checks.digisac` (no env) → `{ "ok": false, "detail": "Missing: ..." }`
- [ ] Local rollout: set `DIGISAC_*` in `.env.local`, `npm run test:digisac` → `✅ Auth OK`
- [ ] Local end-to-end: send a message from `DigisacWhatsappCard`, reply from phone, confirm it appears in the card
- [ ] If the `GET /services/{id}` ping returns 404, file a follow-up to switch to `GET /services` (lista) or `GET /contacts?limit=1`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL is printed. Open it and verify the diff is exactly the 6 commits listed above.

---

## Manual verification (deferred to rollout, NOT part of this plan)

These checks require the actual Digisac token and are executed outside the implementation plan, as part of the rollout described in the spec § Plano de rollout:

- Setting `DIGISAC_*` in `.env.local` and running `npm run test:digisac` to verify `✅ Auth OK`
- Running `vercel env add` for the 4 vars and triggering a redeploy
- SSH into Swarm, edit `.env`, run `docker service update --force --with-registry-auth`
- Registering the webhook URLs in the Digisac panel (3 envs, same or env-specific secret)
- End-to-end: card → outbound message → received on phone → reply → inbound webhook → card updates

If the `GET /services/{id}` ping returns `404` during the local smoke test, that is a follow-up — adjust the health check and smoke script to use whatever endpoint the Digisac API exposes for token validation (`GET /services` list, `GET /contacts?limit=1`, etc.), then commit and push to the same branch.
