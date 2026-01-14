import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function testLogin() {
  try {
    const email = "admin@carreirausa.com";
    const testPassword = "Admin@2024";

    console.log("🔐 Testando login...");
    console.log("   Email:", email);
    console.log("   Senha:", testPassword);

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        password: true
      }
    });

    if (!user) {
      console.log("\n❌ Usuário não encontrado");
      return;
    }

    console.log("\n✅ Usuário encontrado:");
    console.log("   Nome:", user.name);
    console.log("   Role:", user.role);
    console.log("   Ativo:", user.active);
    console.log("   Senha definida:", user.password ? "SIM" : "NÃO");

    if (!user.password) {
      console.log("\n❌ Usuário não tem senha definida!");
      console.log("Definindo senha agora...");

      const hashedPassword = await bcrypt.hash(testPassword, 12);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      });

      console.log("✅ Senha definida!");
      return;
    }

    const isValid = await bcrypt.compare(testPassword, user.password);

    if (isValid) {
      console.log("\n✅ SENHA CORRETA!");
      console.log("   A autenticação deve funcionar");
    } else {
      console.log("\n❌ SENHA INCORRETA!");
      console.log("   Redefinindo senha...");

      const newHash = await bcrypt.hash(testPassword, 12);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: newHash, active: true }
      });

      console.log("✅ Senha redefinida com sucesso!");
      console.log("\n📋 Novas credenciais:");
      console.log("   Email:", email);
      console.log("   Senha:", testPassword);
    }

  } catch (error: any) {
    console.error("❌ Erro:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();
