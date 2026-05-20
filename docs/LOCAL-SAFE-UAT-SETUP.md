# Local-Safe UAT Setup

This setup lets you run the app locally for invoice UAT without reusing the shared local `.env.local`.

It isolates:

- PostgreSQL
- Redis
- Next.js runtime env
- QuickBooks environment selection

## Files added

- `docker-compose.local-safe.yml`
- `.env.uat.local.example`
- `scripts/run-with-env.js`
- `scripts/verify-local-safe-env.js`

## Goal

Run the app with:

- a local PostgreSQL database
- a local Redis instance
- `QUICKBOOKS_ENVIRONMENT=sandbox`
- no inherited production QuickBooks auth from the shared DB

## 1. Create the env file

```bash
cp .env.uat.local.example .env.uat.local
```

Update at least:

- `NEXTAUTH_SECRET`
- any optional keys you need for your local flow

Do not set production QuickBooks values here.

## 2. Start local infrastructure

```bash
npm run uat:local:db:up
```

This starts:

- PostgreSQL on `127.0.0.1:55432`
- Redis on `127.0.0.1:56379`

## 3. Dry-check the env

```bash
npm run uat:local:check:dry
```

This validates:

- DB URLs point to localhost
- `NEXTAUTH_URL` points to localhost
- `QUICKBOOKS_ENVIRONMENT` is not `production`

## 4. Apply schema to the isolated DB

```bash
npm run db:push:local-safe
```

Optional seed:

```bash
npm run db:seed:local-safe
```

## 5. Full local-safe verification

```bash
npm run uat:local:check
```

This also checks the local DB and fails if `system_config.quickbooks_is_authenticated = true`.

That matters because QuickBooks auth is stored in the database, not only in `.env`.

## 6. Activate the safe `.env.local`

```bash
npm run uat:local:env:on
```

This:

- backs up your current `.env.local` to `.env.local.shared-backup`
- copies `.env.uat.local` into `.env.local`

This is necessary because Next.js still reads `.env.local` automatically during boot.

## 7. Start the app with the isolated env

```bash
npm run dev:local-safe
```

This now refuses to start unless the local-safe env is active in `.env.local`.

## 8. Run the recurring invoice UAT

Use:

- [UAT-RECURRING-INVOICES-QB.md](/Users/pauloloureiro/Dev/SigmaProjects/carreirahubproject/docs/UAT-RECURRING-INVOICES-QB.md:1)

Important:

- if you need real QuickBooks behavior, connect only to sandbox
- do not import a shared production DB dump into this local-safe setup

## Shutdown

```bash
npm run uat:local:env:off
npm run uat:local:db:down
```

This restores the original `.env.local` and removes the local containers and volumes.
