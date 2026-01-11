import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Reduzir verbosidade em desenvolvimento para melhorar desempenho percebido
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: process.env.POSTGRES_PRISMA_URL,
      },
    },
    // Otimizações de performance
    errorFormat: "minimal",
  });

// Melhorar gerenciamento de conexões - sempre usar singleton em produção
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
} else {
  // Em produção, garantir singleton
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = prisma;
  }
}

// Cleanup ao encerrar
if (typeof window === "undefined") {
  process.on("beforeExit", async () => {
    await prisma.$disconnect();
  });
}

