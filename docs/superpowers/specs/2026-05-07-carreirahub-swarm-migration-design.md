# CarreiraHub Swarm Migration Design

Date: 2026-05-07
Status: Draft for review
Owner: Codex + Paulo

## Goal

Move `carreirahubproject` off Vercel into the existing Docker Swarm host at `carreirausa`, publishing the app at `https://app.carreirausa.com`, while keeping Vercel live during validation and only disabling it after the new runtime is proven.

## Scope

This design covers:

- packaging the Next.js app for Docker runtime
- publishing the app behind the existing Traefik instance
- rehoming Vercel cron responsibilities to the dedicated server
- preserving current integrations: Postgres on `sigmadb`, QuickBooks, DocuSign, Resend, Twilio, S3, Pipedrive, Digisac
- defining validation, rollback, and cutover order

This design does not cover:

- refactoring app business logic
- changing QuickBooks or DocuSign workflows
- replacing Redis/Postgres providers
- changing the product domain model

## Current State

### App

- Framework: Next.js 14 app router
- Start command: `next start`
- Build command: `prisma generate && next build`
- Database: Prisma using `POSTGRES_PRISMA_URL`
- Queue/async surface: BullMQ with Redis
- Scheduled work: many `/api/cron/*` routes currently driven by `vercel.json`

### Existing host

- Host: `carreirausa`
- Runtime: Docker Swarm single-node manager
- Reverse proxy: Traefik already owns ports `80` and `443`
- Existing stacks remain in place: `traefik`, `n8n`, `typebot`, `minio`, `postgres`, `redis`, `portainer`
- SSH hardening is already in place: key auth, fail2ban, ufw
- Recent cleanup already completed: `calcom` removed, swap enabled

### Operational constraints

- The host is not empty. The hub must fit the existing Traefik + Swarm topology.
- We should not introduce another public reverse proxy or standalone host-level process manager.
- The server is single-node, so rollout and rollback must be conservative.
- Vercel must remain live until the new runtime is fully validated.

## Recommended Architecture

### Public routing

- `app.carreirausa.com` will point to the existing `carreirausa` host.
- Traefik will terminate TLS and route traffic to a new internal hub service.
- The hub container will expose only an internal app port, expected to remain `3000`.

### App runtime

- The hub will run as a Docker Swarm service with one replica initially.
- The runtime will stay aligned with the current app model:
  - build image
  - run `next start`
  - use external Postgres on `sigmadb`
  - use Redis via `REDIS_URL`

### Data and integration dependencies

- Postgres stays external on `sigmadb`
- Redis may use the Redis already running on the same Swarm host, provided the app is given the correct reachable `REDIS_URL`
- QuickBooks, DocuSign, Resend, Twilio, Pipedrive, Digisac, and S3 remain third-party dependencies; only their callback/base URLs change

## Deployment Artifacts

We will add the following deployment artifacts to the repo:

- `Dockerfile`
- `.dockerignore`
- one swarm deployment manifest for the hub service
- one env template for production runtime values
- one host scheduler definition for cron replacement

We will not add:

- `nginx` config for public ingress
- `pm2`
- docker-compose as the primary production runtime

## Runtime Configuration

### Required app URL settings

The new runtime must use:

- `NEXTAUTH_URL=https://app.carreirausa.com`
- `NEXT_PUBLIC_APP_URL=https://app.carreirausa.com`
- `QUICKBOOKS_REDIRECT_URI=https://app.carreirausa.com/api/quickbooks/oauth/callback`

### Secrets and integrations

The dedicated runtime must receive the existing production values for:

- `POSTGRES_PRISMA_URL`
- `REDIS_URL`
- `NEXTAUTH_SECRET`
- QuickBooks credentials
- DocuSign credentials and template IDs
- `DOCUSIGN_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- Twilio credentials
- AWS/S3 credentials
- Pipedrive credentials
- Digisac credentials
- `CRON_SECRET`

### Cron auth normalization

The current codebase uses both `CRON_SECRET` and `VERCEL_CRON_SECRET`.

Before full cutover, the new deployment should normalize cron auth so the dedicated runtime does not rely on Vercel-specific headers or secrets. The dedicated scheduler should call cron endpoints with a standard bearer token using one stable secret.

## Cron Migration

### Current state

`vercel.json` currently schedules many endpoints, including:

- queue processing
- queue monitoring
- QuickBooks token refresh
- QuickBooks sync
- digest emails
- invoice reminders
- contract reminders
- collection calls
- auto charge flows

### Target state

These schedules move to the dedicated server. The scheduler should call the same app endpoints over HTTPS using `Authorization: Bearer <CRON_SECRET>`.

### Recommendation

Use host-managed scheduling instead of embedding a second worker system immediately:

- start with host cron or systemd timers that call the app endpoints
- keep the route logic unchanged where possible
- only after the app is stable on the host should we consider deeper worker/process refactors

This keeps the first migration slice narrow and reduces drift from the currently working production behavior.

## Build and Release Strategy

### Recommended path

- build the image in a controlled environment
- push the finished image to a registry
- let the swarm host pull and deploy that image

This is preferred over ad hoc source builds on the production host because the host is shared and capacity is finite.

### Acceptable fallback

If registry setup is not ready, an initial controlled build on the host is acceptable, but only as a temporary bridge. The long-term path should be image-based deployment.

## Validation Plan

Validation must happen on `app.carreirausa.com` while Vercel remains live.

### Core app validation

- admin sign-in
- dashboard render
- hub/client sign-in
- invoice creation
- invoice payment link and hub pay pages

### Integration validation

- QuickBooks OAuth callback
- QuickBooks invoice creation/sync
- DocuSign send
- DocuSign webhook receive
- Resend send flow
- Resend webhook receive
- S3 upload/download flow
- Twilio webhook receive

### Cron validation

At minimum validate these on the dedicated runtime:

- `process-queue`
- `monitor-queues`
- `refresh-quickbooks-token`
- `send-scheduled-invoices`
- one digest route

### Runtime validation

- container health
- Traefik routing
- database reachability
- Redis reachability
- memory pressure after deploy

## Rollback Plan

Rollback must remain available until Vercel is fully retired.

If the dedicated runtime fails validation:

- keep DNS and public traffic on the existing working target
- revert provider webhook targets if they were switched
- scale down or remove the Swarm hub service
- keep Vercel as the active production runtime

The migration should be reversible without database rollback because Postgres remains the same external system of record.

## Cutover Sequence

1. Add deployment artifacts to the repo.
2. Build and publish the first Docker image.
3. Deploy the hub service to Swarm behind Traefik at `app.carreirausa.com`.
4. Load production-equivalent env vars into the new runtime.
5. Validate login, core pages, and critical integrations.
6. Move provider callback URLs and webhook targets to `app.carreirausa.com`.
7. Validate critical cron routes using the host scheduler.
8. Observe the new runtime for stability.
9. Only after successful validation, retire Vercel from active production duty.

## Risks

### Medium risk

- single-node swarm means rollout mistakes affect the host directly
- host capacity is improved but still limited compared with a dedicated larger node
- cron auth is currently inconsistent between `CRON_SECRET` and `VERCEL_CRON_SECRET`

### High risk if skipped

- disabling Vercel before provider callbacks and cron flows are verified
- introducing a second reverse proxy that conflicts with Traefik
- building a custom deployment path that diverges from the current runtime assumptions

## Decision Summary

We will use a parallel-safe migration:

- app target: `app.carreirausa.com`
- runtime target: existing Swarm host with Traefik
- ingress model: Traefik only
- app process model: Docker service running the Next.js app
- database: stay on `sigmadb`
- Vercel: remain live until dedicated runtime validation is complete

