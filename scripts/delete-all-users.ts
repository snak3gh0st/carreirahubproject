/**
 * Delete All Users Script
 *
 * CUIDADO: Este script deleta TODOS os usuários do sistema!
 *
 * Uso: npm run user:delete-all
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function deleteAllUsers() {
  try {
    console.log("⚠️  ATENÇÃO: Este script vai deletar TODOS os usuários!");
    console.log("   Aguarde 3 segundos para cancelar (Ctrl+C)...\n");

    await new Promise(resolve => setTimeout(resolve, 3000));

    const users = await prisma.user.findMany();
    console.log(`   Encontrados ${users.length} usuários para deletar.\n`);

    if (users.length === 0) {
      console.log("✅ Nenhum usuário para deletar.");
      return;
    }

    // Delete all users
    const result = await prisma.user.deleteMany();

    console.log(`✅ ${result.count} usuários deletados com sucesso!\n`);

  } catch (error) {
    console.error("❌ Erro ao deletar usuários:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllUsers();
