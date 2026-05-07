# syntax=docker/dockerfile:1

# ─── Stage 1: install deps ───────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# ─── Stage 2: build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

# Full deps (including devDependencies for build)
COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .

# Build-time env vars: needed only so next build can collect page data.
# These stay in the builder stage and are NOT copied to the runner image.
ARG OPENAI_API_KEY
ARG DATABASE_URL
ARG POSTGRES_PRISMA_URL
ARG NEXTAUTH_SECRET
ENV OPENAI_API_KEY=$OPENAI_API_KEY
ENV DATABASE_URL=$DATABASE_URL
ENV POSTGRES_PRISMA_URL=$POSTGRES_PRISMA_URL
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET

# Build generates Prisma client then runs next build (output: standalone)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── Stage 3: runtime ────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl curl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Next.js standalone bundle
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma runtime: generated client + query engine binary
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health 2>/dev/null || exit 1

CMD ["node", "server.js"]
