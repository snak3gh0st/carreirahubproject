/**
 * User Management Script with Password
 *
 * Usage:
 *   Create:  npm run user:create-secure <name> <role> <password>
 *   Delete:  npm run user:delete <email>
 *   Update:  npm run user:update <email> <field> <value>
 *   List:    npm run user:list
 *   Change Password: npm run user:password <email> <new-password>
 *
 * Available Roles: ADMIN, FINANCE, SALES, SDR, SUPPORT, OPERATIONAL, HEAD_OPERACIONAL, COMMERCIAL
 *
 * Examples:
 *   npm run user:create-secure "John Finance" FINANCE senha123
 *   npm run user:create-secure "Jane Commercial" COMMERCIAL comercial456
 *   npm run user:delete john.finance@carreirausa.com
 *   npm run user:update john.finance@carreirausa.com role ADMIN
 *   npm run user:password john.finance@carreirausa.com novaSenha789
 *   npm run user:list
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const VALID_ROLES: UserRole[] = [
  "ADMIN",
  "FINANCE",
  "SALES",
  "SDR",
  "SUPPORT",
  "OPERATIONAL",
  "HEAD_OPERACIONAL",
  "COMMERCIAL",
];

const DOMAIN = "carreirausa.com";

function generateEmail(name: string): string {
  // Convert name to email format: "John Doe" -> "john.doe@carreirausa.com"
  const emailName = name
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9.]/g, "");
  return `${emailName}@${DOMAIN}`;
}

async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function createUser(name: string, role: UserRole, password: string) {
  try {
    if (!VALID_ROLES.includes(role)) {
      console.error(`❌ Role inválido: ${role}`);
      console.log(`   Roles válidos: ${VALID_ROLES.join(", ")}`);
      process.exit(1);
    }

    if (!password || password.length < 6) {
      console.error(`❌ Senha deve ter no mínimo 6 caracteres`);
      process.exit(1);
    }

    const email = generateEmail(name);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log(`⚠️  Usuário já existe: ${email}`);
      console.log(`   ID: ${existingUser.id}`);
      console.log(`   Nome: ${existingUser.name}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log(`   Ativo: ${existingUser.active}`);

      if (!existingUser.active) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { active: true },
        });
        console.log(`   ✅ Usuário reativado!`);
      }
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create new user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        role,
        password: hashedPassword,
        passwordHashedAt: new Date(),
        active: true,
      },
    });

    console.log(`\n✅ Usuário criado com sucesso!`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Nome: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   ID: ${user.id}`);
    console.log(`\n💡 Login:`);
    console.log(`   Email: ${email}`);
    console.log(`   Senha: ${password}`);
  } catch (error) {
    console.error("❌ Erro ao criar usuário:", error);
    process.exit(1);
  }
}

async function deleteUser(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ Usuário não encontrado: ${email}`);
      process.exit(1);
    }

    // Show user details before deletion
    console.log(`\n⚠️  Deletando usuário:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Nome: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   ID: ${user.id}`);

    // Delete user
    await prisma.user.delete({
      where: { email },
    });

    console.log(`\n✅ Usuário deletado com sucesso!`);
  } catch (error) {
    console.error("❌ Erro ao deletar usuário:", error);
    process.exit(1);
  }
}

async function updateUser(email: string, field: string, value: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ Usuário não encontrado: ${email}`);
      process.exit(1);
    }

    const updateData: any = {};

    switch (field.toLowerCase()) {
      case "name":
        updateData.name = value;
        break;
      case "role":
        if (!VALID_ROLES.includes(value as UserRole)) {
          console.error(`❌ Role inválido: ${value}`);
          console.log(`   Roles válidos: ${VALID_ROLES.join(", ")}`);
          process.exit(1);
        }
        updateData.role = value as UserRole;
        break;
      case "active":
        updateData.active = value.toLowerCase() === "true";
        break;
      case "email":
        updateData.email = value;
        break;
      default:
        console.error(`❌ Campo inválido: ${field}`);
        console.log(`   Campos válidos: name, role, active, email`);
        process.exit(1);
    }

    const updatedUser = await prisma.user.update({
      where: { email },
      data: updateData,
    });

    console.log(`\n✅ Usuário atualizado com sucesso!`);
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Nome: ${updatedUser.name}`);
    console.log(`   Role: ${updatedUser.role}`);
    console.log(`   Ativo: ${updatedUser.active}`);
  } catch (error) {
    console.error("❌ Erro ao atualizar usuário:", error);
    process.exit(1);
  }
}

async function changePassword(email: string, newPassword: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ Usuário não encontrado: ${email}`);
      process.exit(1);
    }

    if (!newPassword || newPassword.length < 6) {
      console.error(`❌ Senha deve ter no mínimo 6 caracteres`);
      process.exit(1);
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        passwordHashedAt: new Date(),
      },
    });

    console.log(`\n✅ Senha alterada com sucesso!`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Nome: ${user.name}`);
    console.log(`   Nova senha: ${newPassword}`);
  } catch (error) {
    console.error("❌ Erro ao alterar senha:", error);
    process.exit(1);
  }
}

async function listUsers() {
  try {
    const users = await prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    if (users.length === 0) {
      console.log("Nenhum usuário encontrado.");
      return;
    }

    console.log(`\n📋 Total de Usuários: ${users.length}\n`);

    // Group by role
    const usersByRole: Record<string, any[]> = {};
    users.forEach((user) => {
      if (!usersByRole[user.role]) {
        usersByRole[user.role] = [];
      }
      usersByRole[user.role].push(user);
    });

    // Display by role
    Object.entries(usersByRole).forEach(([role, roleUsers]) => {
      console.log(`\n🏢 ${role} (${roleUsers.length})`);
      console.log("─".repeat(60));
      roleUsers.forEach((user) => {
        const status = user.active ? "✅" : "❌";
        const hasPassword = user.password ? "🔒" : "🔓";
        console.log(`${status} ${hasPassword} ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   ID: ${user.id}`);
        console.log("");
      });
    });

    console.log("\n🔒 = Com senha | 🔓 = Sem senha");
  } catch (error) {
    console.error("❌ Erro ao listar usuários:", error);
    process.exit(1);
  }
}

async function main() {
  const command = process.argv[2];

  if (!command) {
    console.log(`
📚 Gerenciamento de Usuários com Senha

Uso:
  Criar:           npm run user:create-secure <nome> <role> <senha>
  Deletar:         npm run user:delete <email>
  Atualizar:       npm run user:update <email> <campo> <valor>
  Listar:          npm run user:list
  Alterar Senha:   npm run user:password <email> <nova-senha>

Roles Disponíveis:
  ${VALID_ROLES.join(", ")}

Exemplos:
  npm run user:create-secure "John Finance" FINANCE senha123
  npm run user:create-secure "Jane Commercial" COMMERCIAL comercial456
  npm run user:delete john.finance@carreirausa.com
  npm run user:update john.finance@carreirausa.com role ADMIN
  npm run user:password john.finance@carreirausa.com novaSenha789
  npm run user:list

Nota: Todos os emails usam o domínio @${DOMAIN}
Senha mínima: 6 caracteres
`);
    process.exit(0);
  }

  switch (command.toLowerCase()) {
    case "create": {
      const name = process.argv[3];
      const role = process.argv[4] as UserRole;
      const password = process.argv[5];

      if (!name || !role || !password) {
        console.error("❌ Uso: npm run user:create-secure <nome> <role> <senha>");
        console.log(`   Roles disponíveis: ${VALID_ROLES.join(", ")}`);
        console.log(`   Senha mínima: 6 caracteres`);
        process.exit(1);
      }

      await createUser(name, role, password);
      break;
    }

    case "delete": {
      const email = process.argv[3];

      if (!email) {
        console.error("❌ Uso: npm run user:delete <email>");
        process.exit(1);
      }

      await deleteUser(email);
      break;
    }

    case "update": {
      const email = process.argv[3];
      const field = process.argv[4];
      const value = process.argv[5];

      if (!email || !field || !value) {
        console.error("❌ Uso: npm run user:update <email> <campo> <valor>");
        console.log("   Campos válidos: name, role, active, email");
        process.exit(1);
      }

      await updateUser(email, field, value);
      break;
    }

    case "password": {
      const email = process.argv[3];
      const newPassword = process.argv[4];

      if (!email || !newPassword) {
        console.error("❌ Uso: npm run user:password <email> <nova-senha>");
        console.log("   Senha mínima: 6 caracteres");
        process.exit(1);
      }

      await changePassword(email, newPassword);
      break;
    }

    case "list": {
      await listUsers();
      break;
    }

    default:
      console.error(`❌ Comando desconhecido: ${command}`);
      console.log("   Comandos válidos: create, delete, update, password, list");
      process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("❌ Erro fatal:", error);
  process.exit(1);
});
