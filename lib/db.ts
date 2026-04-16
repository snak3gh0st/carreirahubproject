import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Ensure the Neon pooled connection URL includes proper PgBouncer and pool params.
 * Neon's pooled endpoint requires pgbouncer=true for Prisma compatibility.
 * We also set connection_limit and pool_timeout to prevent P2024 exhaustion errors
 * during heavy workloads (e.g., QuickBooks cron sync with thousands of DB calls).
 */
function buildConnectionUrl(): string | undefined {
  const baseUrl = process.env.POSTGRES_PRISMA_URL;
  if (!baseUrl) return baseUrl;

  try {
    const url = new URL(baseUrl);

    // Ensure pgbouncer=true for Neon pooled connections
    if (!url.searchParams.has("pgbouncer")) {
      url.searchParams.set("pgbouncer", "true");
    }

    // Set connection_limit if not already specified in the URL.
    // Vercel serverless functions benefit from a moderate pool size (10)
    // to handle concurrent DB operations within a single request.
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "10");
    }

    // Set pool_timeout to 30s (up from default 10s) to give long-running
    // sync operations time to acquire connections under load.
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "30");
    }

    return url.toString();
  } catch {
    // If URL parsing fails, return the original URL unchanged
    return baseUrl;
  }
}

const connectionUrl = buildConnectionUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Reduzir verbosidade em desenvolvimento para melhorar desempenho percebido
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(connectionUrl
      ? { datasources: { db: { url: connectionUrl } } }
      : {}),
    // Otimizacoes de performance
    errorFormat: "minimal",
  });

// Sempre usar singleton (dev e producao) para evitar multiplas instancias do pool
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}

// Cleanup ao encerrar
if (typeof window === "undefined") {
  process.on("beforeExit", async () => {
    await prisma.$disconnect();
  });
}

