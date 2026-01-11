/**
 * Script para limpar todos os dados do banco (exceto usuário admin padrão)
 * 
 * Uso: node scripts/clear-database.js
 * 
 * ⚠️ ATENÇÃO: Este script remove TODOS os dados do banco!
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function clearDatabase() {
  console.log("🗑️  Limpando banco de dados...\n");

  try {
    console.log("   Removendo messages...");
    await prisma.message.deleteMany();
    
    console.log("   Removendo conversations...");
    await prisma.conversation.deleteMany();
    
    console.log("   Removendo lead qualifications...");
    await prisma.leadQualification.deleteMany();
    
    console.log("   Removendo invoices...");
    await prisma.invoice.deleteMany();
    
    console.log("   Removendo contracts...");
    await prisma.contract.deleteMany();
    
    console.log("   Removendo deals...");
    await prisma.deal.deleteMany();
    
    console.log("   Removendo customers...");
    await prisma.customer.deleteMany();
    
    console.log("   Removendo leads...");
    await prisma.lead.deleteMany();
    
    console.log("   Removendo integration logs...");
    await prisma.integrationLog.deleteMany();
    
    console.log("   Removendo usuários (exceto admin)...");
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        email: { not: "admin@carreirausa.com" },
      },
    });
    
    console.log(`\n✅ Banco de dados limpo!`);
    console.log(`   ${deletedUsers.count} usuário(s) removido(s)`);
    console.log(`   Usuário admin@carreirausa.com mantido\n`);

  } catch (error) {
    console.error("❌ Erro ao limpar banco:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearDatabase()
  .then(() => {
    console.log("🎉 Processo concluído!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Erro fatal:", error);
    process.exit(1);
  });
