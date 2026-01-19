/**
 * Test User Login Script
 * Verifica se a senha do usuário está correta e pode fazer login
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function testLogin(email: string, password: string) {
  try {
    console.log(`\n🔍 Testando login para: ${email}`);
    console.log(`   Senha fornecida: ${password}`);

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        password: true,
      },
    });

    if (!user) {
      console.log(`❌ Usuário não encontrado: ${email}`);
      return;
    }

    console.log(`\n✅ Usuário encontrado:`);
    console.log(`   Nome: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Ativo: ${user.active}`);
    console.log(`   Tem senha: ${user.password ? "Sim" : "Não"}`);

    if (!user.password) {
      console.log(`\n❌ Usuário não tem senha configurada!`);
      return;
    }

    // Verificar senha
    const isValid = await bcrypt.compare(password, user.password);

    if (isValid) {
      console.log(`\n✅ SENHA CORRETA! Login deve funcionar.`);
    } else {
      console.log(`\n❌ SENHA INCORRETA! Login vai falhar.`);
      console.log(`\n🔧 Informações de debug:`);
      console.log(`   Hash armazenado: ${user.password.substring(0, 20)}...`);
      console.log(`   Tamanho do hash: ${user.password.length}`);
      console.log(`   Formato válido: ${user.password.startsWith("$2")}`);
    }
  } catch (error) {
    console.error("❌ Erro ao testar login:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Pegar email e senha dos argumentos
const email = process.argv[2] || "comercial@carreirausa.com";
const password = process.argv[3] || "comercial123";

testLogin(email, password);
