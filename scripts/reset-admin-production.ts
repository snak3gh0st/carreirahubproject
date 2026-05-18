/**
 * Reset admin password in PRODUCTION database
 * Uses POSTGRES_PRISMA_URL from environment
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL
    }
  }
});

async function resetPassword() {
  try {
    const email = "admin@carreirausa.com";
    const password = "Admin2024!";

    console.log("🔐 Resetando senha no BANCO DE PRODUÇÃO");
    console.log("   Email:", email);
    console.log("   Nova senha:", password);
    console.log("   Database:", process.env.POSTGRES_PRISMA_URL ? "Neon (Production)" : "Local");

    // Create hash
    const hash = await bcrypt.hash(password, 12);

    // Update user
    await prisma.user.update({
      where: { email },
      data: {
        password: hash,
        active: true
      }
    });

    console.log("\n✅ Senha atualizada no banco de produção!");

    // Test password
    const user = await prisma.user.findUnique({
      where: { email },
      select: { password: true, active: true }
    });

    const valid = await bcrypt.compare(password, user!.password!);

    console.log("\n🧪 Teste de validação:");
    console.log("   Usuário ativo:", user?.active);
    console.log("   Senha válida:", valid ? "✅ SIM" : "❌ NÃO");

    if (valid) {
      console.log("\n" + "=".repeat(50));
      console.log("✅ SUCESSO! Credenciais prontas:");
      console.log("=".repeat(50));
      console.log("Email:", email);
      console.log("Senha:", password);
      console.log("URL: https://app.carreirausa.com/auth/signin");
      console.log("=".repeat(50));
    } else {
      console.log("\n❌ ERRO: Senha não validou!");
    }

    await prisma.$disconnect();
  } catch (error: any) {
    console.error("\n❌ Erro:", error.message);
    console.error(error);
    process.exit(1);
  }
}

resetPassword();
