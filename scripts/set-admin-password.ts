/**
 * Script para definir/resetar senha do admin
 *
 * Uso: npx tsx scripts/set-admin-password.ts [senha]
 * Exemplo: npx tsx scripts/set-admin-password.ts Admin@2024
 *
 * Se não fornecer senha, será usada "Admin@123456"
 */

import { PrismaClient } from "@prisma/client";
import { authService } from "../lib/services/auth.service";

const prisma = new PrismaClient();

async function setAdminPassword() {
  const email = "admin@carreirausa.com";
  const password = process.argv[2] || "Admin@123456";

  try {
    console.log(`🔐 Definindo senha para ${email}...`);

    // Verificar se usuário existe
    let user = await prisma.user.findUnique({
      where: { email },
    });

    // Criar usuário se não existir
    if (!user) {
      console.log(`📝 Usuário não existe, criando...`);
      user = await prisma.user.create({
        data: {
          email,
          name: "Admin User",
          role: "ADMIN",
          active: true,
        },
      });
      console.log(`✅ Usuário criado: ${email}`);
    }

    // Hash da senha usando bcrypt
    const hashedPassword = await authService.hashPassword(password);

    // Atualizar senha do usuário
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        active: true // Garantir que está ativo
      },
    });

    console.log(`\n✅ Senha definida com sucesso!`);
    console.log(`\n📋 Credenciais de Login:`);
    console.log(`   Email: ${email}`);
    console.log(`   Senha: ${password}`);
    console.log(`\n🌐 Faça login em: https://carreirausa.sigmaintel.io/auth/signin`);
    console.log(`\n⚠️  IMPORTANTE: Guarde esta senha em local seguro!`);

  } catch (error: any) {
    console.error("❌ Erro:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setAdminPassword();
