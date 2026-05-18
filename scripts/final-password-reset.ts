/**
 * FINAL password reset - simple and direct
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
    const newPassword = "Senha123"; // Simple password for testing

    console.log("🔍 Conectando ao banco de PRODUÇÃO...");
    console.log("   Database:", process.env.POSTGRES_PRISMA_URL ? "Neon Production" : "Local");

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, password: true }
    });

    if (!user) {
      console.log("❌ Usuário não encontrado!");
      process.exit(1);
    }

    console.log("✅ Usuário encontrado:", user.email);
    console.log("   Hash atual:", user.password?.substring(0, 30) + "...");

    // Create new hash
    console.log("\n🔐 Criando NOVA senha:", newPassword);
    const newHash = await bcrypt.hash(newPassword, 12);
    console.log("   Novo hash criado:", newHash.substring(0, 30) + "...");

    // Update
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: newHash,
        active: true
      }
    });

    console.log("✅ Senha atualizada no banco!");

    // Test immediately
    const updated = await prisma.user.findUnique({
      where: { email },
      select: { password: true }
    });

    const isValid = await bcrypt.compare(newPassword, updated!.password!);

    console.log("\n🧪 Teste de validação:");
    console.log("   Senha testada:", newPassword);
    console.log("   Resultado:", isValid ? "✅ VÁLIDA" : "❌ INVÁLIDA");

    if (isValid) {
      console.log("\n" + "=".repeat(50));
      console.log("✅ SUCESSO! CREDENCIAIS PRONTAS:");
      console.log("=".repeat(50));
      console.log("Email: admin@carreirausa.com");
      console.log("Senha:", newPassword);
      console.log("URL: https://app.carreirausa.com/auth/signin");
      console.log("=".repeat(50));
      console.log("\n⚠️  Teste agora: https://app.carreirausa.com/api/debug/test-auth");
    } else {
      console.log("\n❌ ERRO: Senha não validou corretamente!");
      process.exit(1);
    }

    await prisma.$disconnect();
  } catch (error: any) {
    console.error("\n❌ Erro:", error.message);
    console.error(error);
    process.exit(1);
  }
}

resetPassword();
