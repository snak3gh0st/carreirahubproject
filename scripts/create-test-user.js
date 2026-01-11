/**
 * Script para criar usuário de teste
 * 
 * Uso: node scripts/create-test-user.js [email] [name] [role]
 * Exemplo: node scripts/create-test-user.js admin@test.com "Admin" ADMIN
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function createTestUser() {
  const email = process.argv[2] || "admin@carreirausa.com";
  const name = process.argv[3] || "Admin User";
  const role = process.argv[4] || "ADMIN";

  try {
    // Verificar se usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log(`✅ Usuário já existe: ${email}`);
      console.log(`   ID: ${existingUser.id}`);
      console.log(`   Nome: ${existingUser.name}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log(`   Ativo: ${existingUser.active}`);
      
      // Ativar usuário se estiver inativo
      if (!existingUser.active) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { active: true },
        });
        console.log(`   ✅ Usuário ativado!`);
      }
      return;
    }

    // Criar novo usuário
    const user = await prisma.user.create({
      data: {
        email,
        name,
        role,
        active: true,
      },
    });

    console.log(`✅ Usuário criado com sucesso!`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Nome: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   ID: ${user.id}`);
    console.log(`\n💡 Você pode fazer login com: ${email}`);
    console.log(`   (Senha não é verificada em desenvolvimento)`);
  } catch (error) {
    console.error("❌ Erro ao criar usuário:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
