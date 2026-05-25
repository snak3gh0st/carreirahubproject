# Collection Service Twilio OpenAI Realtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Retell from collection calls and make Twilio Voice + OpenAI Realtime the collection-call provider.

**Architecture:** Keep the existing `CollectionCall` persistence and invoice gates. Replace the provider integration with a Twilio outbound call that bridges to OpenAI Realtime SIP, then accept the OpenAI SIP call with a server-side realtime session configured for collections. Keep post-call analysis in the app using cheaper chat models.

**Tech Stack:** Next.js App Router, Prisma/Postgres, Twilio Voice, OpenAI Realtime SIP, OpenAI chat completions, `node:test` via `npx tsx --test`.

---

### Task 1: Provider Helpers

**Files:**
- Create: `tests/collection-call-voice.test.ts`
- Create: `lib/services/collection-call-voice.ts`

- [ ] Write failing tests for phone normalization, provider config, SIP URI, Twilio status mapping, and OpenAI accept payload.
- [ ] Run `npx tsx --test tests/collection-call-voice.test.ts` and confirm it fails because `lib/services/collection-call-voice.ts` does not exist.
- [ ] Implement `lib/services/collection-call-voice.ts` with pure helper functions and constants only.
- [ ] Re-run `npx tsx --test tests/collection-call-voice.test.ts` and confirm it passes.

### Task 2: Twilio Voice Provider

**Files:**
- Create: `lib/services/collection-voice.service.ts`
- Modify: `lib/services/collection-call.service.ts`
- Modify: `app/api/invoices/[id]/collection-call/route.ts`
- Modify: `app/api/cron/collection-calls/route.ts`

- [ ] Replace Retell service usage with `collectionVoiceService`.
- [ ] Persist `provider: "TWILIO_OPENAI_REALTIME"` on new `CollectionCall` rows.
- [ ] Log provider actions as `TWILIO_OPENAI_REALTIME`.
- [ ] Keep invoice eligibility, business hours, max attempts, and 24-hour cooldown unchanged.

### Task 3: Webhooks And TwiML

**Files:**
- Create: `app/api/webhooks/collection-calls/twilio/twiml/route.ts`
- Create: `app/api/webhooks/collection-calls/twilio/status/route.ts`
- Create: `app/api/webhooks/openai/realtime/collection-calls/route.ts`
- Delete: `app/api/webhooks/retell/route.ts`

- [ ] Add a TwiML endpoint that dials the OpenAI SIP URI with `X-Collection-Call-Id`.
- [ ] Add a Twilio status callback endpoint that updates `CollectionCall` status and duration.
- [ ] Add an OpenAI realtime incoming-call webhook that accepts the SIP call with collection instructions.
- [ ] Remove Retell webhook route.

### Task 4: Retell Removal And Verification

**Files:**
- Delete: `lib/services/retell.service.ts`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `lib/utils/error-fallback.ts`
- Modify: `lib/utils/webhook-event-id.ts`
- Modify: `tests/openai-lazy-init.test.ts` if imports change.

- [ ] Remove Retell env vars and replace them with Twilio/OpenAI collection-call env vars.
- [ ] Remove Retell service labels and webhook event branches.
- [ ] Run `rg -n "retell|RETELL|Retell" app lib tests prisma .env.example README.md`.
- [ ] Run `npx tsx --test tests/collection-call-voice.test.ts tests/openai-lazy-init.test.ts`.
- [ ] Run `npx tsc --noEmit --pretty false`.
