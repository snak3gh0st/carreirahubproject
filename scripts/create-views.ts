const { PrismaClient } = require("@prisma/client");
const { readFileSync } = require("fs");
const { join } = require("path");

const prisma = new PrismaClient();

/**
 * Script para criar views SQL materializadas no banco de dados
 * 
 * Execute: npx tsx scripts/create-views.ts
 */
async function createViews() {
  try {
    console.log("📊 Criando views SQL materializadas...");

    const viewsPath = join(process.cwd(), "prisma/migrations/create_views.sql");
    const sql = readFileSync(viewsPath, "utf-8");

    // Dividir SQL em comandos individuais
    const commands = sql
      .split(";")
      .map((cmd: string) => cmd.trim())
      .filter((cmd: string) => cmd.length > 0 && !cmd.startsWith("--"));

    for (const command of commands) {
      if (command.trim()) {
        try {
          await prisma.$executeRawUnsafe(command);
          console.log(`✅ View criada: ${command.split(" ")[2]}`);
        } catch (error: any) {
          // Ignorar erro se view já existe
          if (error.message?.includes("already exists")) {
            console.log(`⚠️  View já existe: ${command.split(" ")[2]}`);
          } else {
            console.error(`❌ Erro ao criar view:`, error.message);
          }
        }
      }
    }

    console.log("✅ Todas as views foram criadas com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao criar views:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createViews();

