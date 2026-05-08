# CarreiraHub Swarm Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run `carreirahubproject` at `https://app.carreirausa.com` on the existing `carreirausa` Docker Swarm host, validate it in parallel with Vercel, and only retire Vercel after the dedicated runtime is proven.

**Architecture:** Package the Next.js app as a standalone Docker image, deploy it as a single Swarm service behind the existing Traefik router on `network_public`, normalize the Vercel-specific cron auth surface to a host-friendly bearer token flow, and add deployment/runbook artifacts so cutover and rollback are explicit. Keep Postgres on `sigmadb`, reuse Redis through `REDIS_URL`, and leave Vercel live until the new runtime passes smoke validation.

**Tech Stack:** Next.js 14, TypeScript, Prisma, BullMQ, Redis, Docker, Docker Swarm, Traefik, shell cron, node:test with `tsx`.

---

## File Structure

### New files

- `Dockerfile`
  - multi-stage image for Next.js standalone runtime
- `.dockerignore`
  - keep Docker build context small and avoid shipping local env/state
- `lib/cron/authorize-cron.ts`
  - shared helper that accepts dedicated-server bearer auth and preserves compatibility with the current Vercel cron path during migration
- `tests/infra/standalone-config.test.ts`
  - asserts the repo is configured for standalone Next.js output
- `tests/cron/authorize-cron.test.ts`
  - focused auth helper coverage for bearer and legacy Vercel header cases
- `tests/infra/swarm-assets.test.ts`
  - verifies stack/env/cron artifact content for the dedicated runtime
- `infra/swarm/carreirahub.stack.yml`
  - Swarm service definition using Traefik and `network_public`
- `infra/swarm/carreirahub.env.example`
  - production env template for the dedicated runtime
- `infra/swarm/carreirahub.crontab.example`
  - host cron entries calling the new app with bearer auth
- `infra/swarm/run-cron.sh`
  - small host-safe curl wrapper for cron jobs
- `docs/superpowers/runbooks/2026-05-07-carreirahub-cutover.md`
  - operator checklist for deploy, smoke validation, cutover, and rollback

### Modified files

- `next.config.js`
  - enable `output: "standalone"` while preserving current strict build settings
- `.env.example`
  - add the dedicated runtime URL and cron notes so the server env matches `app.carreirausa.com`
- `app/api/cron/process-queue/route.ts`
  - replace direct `VERCEL_CRON_SECRET` check with shared helper
- `app/api/cron/monitor-queues/route.ts`
  - replace direct `VERCEL_CRON_SECRET` check with shared helper
- `app/api/cron/refresh-quickbooks-token/route.ts`
  - accept bearer auth from the new scheduler while preserving migration compatibility

### Existing files intentionally left alone in the first migration slice

- `vercel.json`
  - keep Vercel crons alive during parallel validation; retire only after cutover
- `package.json`
  - keep `build` and `start` contracts unchanged
- app business logic, Prisma schema, and provider integrations
  - no functional business rewrite in the migration slice

---

### Task 1: Enable standalone Next.js output for container packaging

**Files:**
- Modify: `next.config.js`
- Create: `tests/infra/standalone-config.test.ts`

- [ ] **Step 1: Write the failing standalone-config test**

```ts
import test from "node:test";
import assert from "node:assert/strict";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const nextConfig = require("../../next.config.js");

test("next config enables standalone output for the Docker runtime", () => {
  assert.equal(nextConfig.output, "standalone");
  assert.deepEqual(nextConfig.typescript, { ignoreBuildErrors: false });
  assert.deepEqual(nextConfig.eslint, { ignoreDuringBuilds: false });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/infra/standalone-config.test.ts`
Expected: FAIL with `undefined !== 'standalone'`

- [ ] **Step 3: Add standalone output to the existing Next config**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;
```

- [ ] **Step 4: Run the focused test again**

Run: `npx tsx --test tests/infra/standalone-config.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add next.config.js tests/infra/standalone-config.test.ts
git commit -m "build: enable standalone next output"
```

### Task 2: Add the Docker runtime contract and production env template

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `infra/swarm/carreirahub.env.example`
- Modify: `.env.example`
- Test: `tests/infra/swarm-assets.test.ts`

- [ ] **Step 1: Write the failing infrastructure asset test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("docker runtime assets target app.carreirausa.com and standalone output", () => {
  const dockerfile = readFileSync("Dockerfile", "utf8");
  const dockerignore = readFileSync(".dockerignore", "utf8");
  const envTemplate = readFileSync("infra/swarm/carreirahub.env.example", "utf8");

  assert.match(dockerfile, /COPY --from=builder \/app\/\.next\/standalone/);
  assert.match(dockerfile, /CMD \["node", "server\.js"\]/);
  assert.match(dockerignore, /\.next/);
  assert.match(dockerignore, /\.env\.local/);
  assert.match(envTemplate, /NEXTAUTH_URL=https:\/\/app\.carreirausa\.com/);
  assert.match(envTemplate, /NEXT_PUBLIC_APP_URL=https:\/\/app\.carreirausa\.com/);
  assert.match(
    envTemplate,
    /QUICKBOOKS_REDIRECT_URI=https:\/\/app\.carreirausa\.com\/api\/quickbooks\/oauth\/callback/,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/infra/swarm-assets.test.ts`
Expected: FAIL with `ENOENT` for one or more missing files

- [ ] **Step 3: Create the Dockerfile**

```Dockerfile
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 4: Create the Docker ignore file**

```gitignore
.git
.next
node_modules
npm-debug.log
.env
.env.local
.env.*.local
coverage
.vercel
docs/superpowers/plans
docs/superpowers/specs
```

- [ ] **Step 5: Create the dedicated runtime env template and update `.env.example`**

`infra/swarm/carreirahub.env.example`

```env
NODE_ENV=production
PORT=3000

POSTGRES_PRISMA_URL=postgres://USER:PASSWORD@sigmadb-host:5432/carreirahub
REDIS_URL=redis://redis:6379

NEXTAUTH_SECRET=
NEXTAUTH_URL=https://app.carreirausa.com
NEXT_PUBLIC_APP_URL=https://app.carreirausa.com

CRON_SECRET=

QUICKBOOKS_CLIENT_ID=
QUICKBOOKS_CLIENT_SECRET=
QUICKBOOKS_REDIRECT_URI=https://app.carreirausa.com/api/quickbooks/oauth/callback
QUICKBOOKS_ENVIRONMENT=production

DOCUSIGN_INTEGRATION_KEY=
DOCUSIGN_USER_ID=
DOCUSIGN_ACCOUNT_ID=
DOCUSIGN_BASE_URL=https://na4.docusign.net
DOCUSIGN_PRIVATE_KEY=
DOCUSIGN_WEBHOOK_SECRET=

RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=
```

Append this dedicated-server note to `.env.example`:

```env
# Dedicated Swarm runtime
NEXTAUTH_URL="https://app.carreirausa.com"
NEXT_PUBLIC_APP_URL="https://app.carreirausa.com"
QUICKBOOKS_REDIRECT_URI="https://app.carreirausa.com/api/quickbooks/oauth/callback"
CRON_SECRET=""
```

- [ ] **Step 6: Run the focused asset test**

Run: `npx tsx --test tests/infra/swarm-assets.test.ts`
Expected: PASS

- [ ] **Step 7: Build the app and image locally**

Run: `npm run build && docker build -t carreirahub:test .`
Expected: Next build succeeds and Docker finishes with a tagged image

- [ ] **Step 8: Commit**

```bash
git add Dockerfile .dockerignore .env.example infra/swarm/carreirahub.env.example tests/infra/swarm-assets.test.ts
git commit -m "build: add swarm runtime packaging assets"
```

### Task 3: Normalize cron authorization for the dedicated scheduler

**Files:**
- Create: `lib/cron/authorize-cron.ts`
- Modify: `app/api/cron/process-queue/route.ts`
- Modify: `app/api/cron/monitor-queues/route.ts`
- Modify: `app/api/cron/refresh-quickbooks-token/route.ts`
- Test: `tests/cron/authorize-cron.test.ts`

- [ ] **Step 1: Write the failing cron-auth helper test**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { authorizeCronHeaders } from "../../lib/cron/authorize-cron";

test("authorizeCronHeaders accepts bearer auth from the dedicated scheduler", () => {
  const result = authorizeCronHeaders(
    {
      authorization: "Bearer cron-secret",
    },
    {
      cronSecret: "cron-secret",
      vercelCronSecret: undefined,
    },
  );

  assert.equal(result.ok, true);
});

test("authorizeCronHeaders still accepts the Vercel cron header during migration", () => {
  const result = authorizeCronHeaders(
    {
      "x-vercel-cron-secret": "vercel-secret",
    },
    {
      cronSecret: "cron-secret",
      vercelCronSecret: "vercel-secret",
    },
  );

  assert.equal(result.ok, true);
});

test("authorizeCronHeaders rejects mismatched secrets", () => {
  const result = authorizeCronHeaders(
    {
      authorization: "Bearer wrong-secret",
    },
    {
      cronSecret: "cron-secret",
      vercelCronSecret: "vercel-secret",
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/cron/authorize-cron.test.ts`
Expected: FAIL with `Cannot find module '../../lib/cron/authorize-cron'`

- [ ] **Step 3: Add the shared helper**

```ts
export interface CronAuthInput {
  authorization?: string | null;
  vercelHeader?: string | null;
}

export interface CronAuthConfig {
  cronSecret?: string;
  vercelCronSecret?: string;
}

export interface CronAuthResult {
  ok: boolean;
  status: number;
}

function extractBearer(authorization?: string | null) {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export function authorizeCronHeaders(
  headers: Record<string, string | undefined>,
  config: CronAuthConfig,
): CronAuthResult {
  const bearer = extractBearer(headers.authorization);
  if (config.cronSecret && bearer === config.cronSecret) {
    return { ok: true, status: 200 };
  }

  if (config.vercelCronSecret && headers["x-vercel-cron-secret"] === config.vercelCronSecret) {
    return { ok: true, status: 200 };
  }

  if (!config.cronSecret && !config.vercelCronSecret) {
    return { ok: true, status: 200 };
  }

  return { ok: false, status: 401 };
}
```

- [ ] **Step 4: Thread the helper into the three cron routes**

At the top of each route:

```ts
import { authorizeCronHeaders } from "@/lib/cron/authorize-cron";
```

Replace the current auth block with:

```ts
const auth = authorizeCronHeaders(
  {
    authorization: request.headers.get("authorization") ?? undefined,
    "x-vercel-cron-secret": request.headers.get("x-vercel-cron-secret") ?? undefined,
  },
  {
    cronSecret: process.env.CRON_SECRET,
    vercelCronSecret: process.env.VERCEL_CRON_SECRET,
  },
);

if (!auth.ok) {
  return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
}
```

- [ ] **Step 5: Run the focused auth test**

Run: `npx tsx --test tests/cron/authorize-cron.test.ts`
Expected: PASS

- [ ] **Step 6: Run the production build**

Run: `npm run build`
Expected: PASS with no new route/type errors

- [ ] **Step 7: Commit**

```bash
git add lib/cron/authorize-cron.ts app/api/cron/process-queue/route.ts app/api/cron/monitor-queues/route.ts app/api/cron/refresh-quickbooks-token/route.ts tests/cron/authorize-cron.test.ts
git commit -m "feat: normalize cron auth for swarm runtime"
```

### Task 4: Add the Swarm service and host cron assets

**Files:**
- Create: `infra/swarm/carreirahub.stack.yml`
- Create: `infra/swarm/carreirahub.crontab.example`
- Create: `infra/swarm/run-cron.sh`
- Test: `tests/infra/swarm-assets.test.ts`

- [ ] **Step 1: Extend the failing infrastructure asset test to cover the stack and cron files**

Append these assertions to `tests/infra/swarm-assets.test.ts`:

```ts
const stack = readFileSync("infra/swarm/carreirahub.stack.yml", "utf8");
const crontab = readFileSync("infra/swarm/carreirahub.crontab.example", "utf8");
const runCron = readFileSync("infra/swarm/run-cron.sh", "utf8");

assert.match(stack, /Host\\(`app\\.carreirausa\\.com`\\)/);
assert.match(stack, /network_public/);
assert.match(stack, /loadbalancer\\.server\\.port=3000/);
assert.match(crontab, /\\/api\\/cron\\/process-queue/);
assert.match(crontab, /\\/api\\/cron\\/refresh-quickbooks-token/);
assert.match(runCron, /Authorization: Bearer \\$CRON_SECRET/);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test tests/infra/swarm-assets.test.ts`
Expected: FAIL with missing Swarm asset files

- [ ] **Step 3: Create the Swarm stack manifest**

`infra/swarm/carreirahub.stack.yml`

```yaml
version: "3.9"

services:
  app:
    image: ghcr.io/pauloloureiro/carreirahub:latest
    env_file:
      - ./carreirahub.env
    networks:
      - default
      - network_public
    deploy:
      replicas: 1
      update_config:
        order: start-first
        parallelism: 1
        failure_action: rollback
      restart_policy:
        condition: on-failure
      labels:
        - traefik.enable=true
        - traefik.docker.network=network_public
        - traefik.http.routers.carreirahub.entrypoints=websecure
        - traefik.http.routers.carreirahub.rule=Host(`app.carreirausa.com`)
        - traefik.http.routers.carreirahub.tls.certresolver=letsencryptresolver
        - traefik.http.routers.carreirahub.service=carreirahub
        - traefik.http.services.carreirahub.loadbalancer.passhostheader=true
        - traefik.http.services.carreirahub.loadbalancer.server.port=3000

networks:
  network_public:
    external: true
```

- [ ] **Step 4: Create the cron runner script**

`infra/swarm/run-cron.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 /api/cron/<route>" >&2
  exit 64
fi

if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "CRON_SECRET is required" >&2
  exit 78
fi

APP_BASE_URL="${APP_BASE_URL:-https://app.carreirausa.com}"
ROUTE="$1"

curl --fail --silent --show-error \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${APP_BASE_URL}${ROUTE}"
```

- [ ] **Step 5: Create the cron schedule example**

`infra/swarm/carreirahub.crontab.example`

```cron
*/5 * * * * /opt/carreirahub/run-cron.sh /api/cron/process-queue >> /var/log/carreirahub-cron.log 2>&1
0 */4 * * * /opt/carreirahub/run-cron.sh /api/cron/monitor-queues >> /var/log/carreirahub-cron.log 2>&1
0 2 * * * /opt/carreirahub/run-cron.sh /api/cron/refresh-quickbooks-token >> /var/log/carreirahub-cron.log 2>&1
0 9 * * * /opt/carreirahub/run-cron.sh /api/cron/send-scheduled-invoices >> /var/log/carreirahub-cron.log 2>&1
0 8 * * * /opt/carreirahub/run-cron.sh /api/cron/finance-digest >> /var/log/carreirahub-cron.log 2>&1
```

- [ ] **Step 6: Run the focused asset test and shell syntax check**

Run: `npx tsx --test tests/infra/swarm-assets.test.ts && bash -n infra/swarm/run-cron.sh`
Expected: PASS

- [ ] **Step 7: Render the stack config**

Run: `docker stack config -c infra/swarm/carreirahub.stack.yml`
Expected: rendered YAML with one `app` service and `network_public` attached

- [ ] **Step 8: Commit**

```bash
git add infra/swarm/carreirahub.stack.yml infra/swarm/carreirahub.crontab.example infra/swarm/run-cron.sh tests/infra/swarm-assets.test.ts
git commit -m "ops: add swarm stack and cron assets"
```

### Task 5: Write the cutover runbook and smoke checklist

**Files:**
- Create: `docs/superpowers/runbooks/2026-05-07-carreirahub-cutover.md`

- [ ] **Step 1: Write the runbook**

```md
# CarreiraHub Swarm Cutover Runbook

## Pre-deploy

1. Confirm DNS for `app.carreirausa.com` points to `5.78.85.178`.
2. Copy `infra/swarm/carreirahub.env.example` to the host as `carreirahub.env` and fill real secrets.
3. Confirm `network_public` exists on the swarm host.
4. Confirm host memory with `free -h` and Docker health with `docker service ls`.

## Deploy

1. Build and push the image:
   - `docker build -t ghcr.io/pauloloureiro/carreirahub:<tag> .`
   - `docker push ghcr.io/pauloloureiro/carreirahub:<tag>`
2. Copy the stack assets to the host.
3. On the host:
   - `docker stack deploy -c carreirahub.stack.yml carreirahub`
4. Confirm:
   - `docker service ls | grep carreirahub`
   - `docker service ps carreirahub_app`

## Smoke validation

1. Open `https://app.carreirausa.com/auth/signin`
2. Validate admin dashboard render.
3. Validate hub login.
4. Validate QuickBooks callback URL by confirming `QUICKBOOKS_REDIRECT_URI`.
5. Trigger:
   - `/api/cron/process-queue`
   - `/api/cron/refresh-quickbooks-token`
6. Send one DocuSign envelope in testable production flow.
7. Send one operational Resend email.

## Provider cutover

1. Update QuickBooks callback URL to `https://app.carreirausa.com/api/quickbooks/oauth/callback`.
2. Update DocuSign webhook target.
3. Update Resend webhook target if required.
4. Update any Twilio/Pipedrive/Digisac webhook targets that still point to Vercel.

## Rollback

1. Revert provider callback/webhook URLs to the Vercel target.
2. `docker service scale carreirahub_app=0`
3. Keep Vercel live as production.
```

- [ ] **Step 2: Review the runbook against the approved spec**

Run this checklist manually:

```text
- app.carreirausa.com present
- Traefik/swarm deploy path present
- cron migration present
- provider callback migration present
- rollback keeps Vercel live
```

Expected: every line covered by the runbook

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/runbooks/2026-05-07-carreirahub-cutover.md
git commit -m "docs: add carreirahub swarm cutover runbook"
```

## Self-Review

- Spec coverage:
  - container packaging: covered by Tasks 1 and 2
  - swarm + Traefik runtime: covered by Task 4
  - cron migration: covered by Tasks 3 and 4
  - validation + rollback: covered by Task 5
  - keep Vercel alive during migration: preserved in Task 5 and by leaving `vercel.json` untouched
- Placeholder scan:
  - no unresolved gaps remain
- Type and path consistency:
  - cron helper name stays `authorizeCronHeaders`
  - swarm public network matches verified host network name `network_public`
  - public app URL stays `app.carreirausa.com` across env, stack, and runbook
