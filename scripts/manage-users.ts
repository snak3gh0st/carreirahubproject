/**
 * User Management Script
 *
 * Usage:
 *   Create:  npm run user:manage create <name> <role>
 *   Delete:  npm run user:manage delete <email>
 *   Update:  npm run user:manage update <email> <field> <value>
 *   List:    npm run user:manage list
 *
 * Available Roles: ADMIN, FINANCE, SALES, SDR, SUPPORT, OPERATIONAL, COMMERCIAL
 *
 * Examples:
 *   npm run user:manage create "John Finance" FINANCE
 *   npm run user:manage create "Jane Commercial" COMMERCIAL
 *   npm run user:manage delete john.finance@carreirausa.com
 *   npm run user:manage update john.finance@carreirausa.com role ADMIN
 *   npm run user:manage update john.finance@carreirausa.com name "John Smith"
 *   npm run user:manage list
 */

import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

const VALID_ROLES: UserRole[] = [
  "ADMIN",
  "FINANCE",
  "SALES",
  "SDR",
  "SUPPORT",
  "OPERATIONAL",
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

async function createUser(name: string, role: UserRole) {
  try {
    if (!VALID_ROLES.includes(role)) {
      console.error(`❌ Invalid role: ${role}`);
      console.log(`   Valid roles: ${VALID_ROLES.join(", ")}`);
      process.exit(1);
    }

    const email = generateEmail(name);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log(`⚠️  User already exists: ${email}`);
      console.log(`   ID: ${existingUser.id}`);
      console.log(`   Name: ${existingUser.name}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log(`   Active: ${existingUser.active}`);

      if (!existingUser.active) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { active: true },
        });
        console.log(`   ✅ User reactivated!`);
      }
      return;
    }

    // Create new user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        role,
        active: true,
      },
    });

    console.log(`\n✅ User created successfully!`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   ID: ${user.id}`);
    console.log(`\n💡 Login with: ${email}`);
    console.log(`   (Password validation not enforced in development)`);
  } catch (error) {
    console.error("❌ Error creating user:", error);
    process.exit(1);
  }
}

async function deleteUser(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }

    // Show user details before deletion
    console.log(`\n⚠️  About to delete user:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   ID: ${user.id}`);

    // Delete user
    await prisma.user.delete({
      where: { email },
    });

    console.log(`\n✅ User deleted successfully!`);
  } catch (error) {
    console.error("❌ Error deleting user:", error);
    process.exit(1);
  }
}

async function updateUser(email: string, field: string, value: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }

    const updateData: any = {};

    switch (field.toLowerCase()) {
      case "name":
        updateData.name = value;
        break;
      case "role":
        if (!VALID_ROLES.includes(value as UserRole)) {
          console.error(`❌ Invalid role: ${value}`);
          console.log(`   Valid roles: ${VALID_ROLES.join(", ")}`);
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
        console.error(`❌ Invalid field: ${field}`);
        console.log(`   Valid fields: name, role, active, email`);
        process.exit(1);
    }

    const updatedUser = await prisma.user.update({
      where: { email },
      data: updateData,
    });

    console.log(`\n✅ User updated successfully!`);
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Name: ${updatedUser.name}`);
    console.log(`   Role: ${updatedUser.role}`);
    console.log(`   Active: ${updatedUser.active}`);
  } catch (error) {
    console.error("❌ Error updating user:", error);
    process.exit(1);
  }
}

async function listUsers() {
  try {
    const users = await prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    if (users.length === 0) {
      console.log("No users found.");
      return;
    }

    console.log(`\n📋 Total Users: ${users.length}\n`);

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
        console.log(`${status} ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   ID: ${user.id}`);
        console.log("");
      });
    });
  } catch (error) {
    console.error("❌ Error listing users:", error);
    process.exit(1);
  }
}

async function main() {
  const command = process.argv[2];

  if (!command) {
    console.log(`
📚 User Management Script

Usage:
  Create:  npm run user:manage create <name> <role>
  Delete:  npm run user:manage delete <email>
  Update:  npm run user:manage update <email> <field> <value>
  List:    npm run user:manage list

Available Roles:
  ${VALID_ROLES.join(", ")}

Examples:
  npm run user:manage create "John Finance" FINANCE
  npm run user:manage create "Jane Commercial" COMMERCIAL
  npm run user:manage delete john.finance@carreirausa.com
  npm run user:manage update john.finance@carreirausa.com role ADMIN
  npm run user:manage update john.finance@carreirausa.com name "John Smith"
  npm run user:manage list

Note: All emails use @${DOMAIN} domain
`);
    process.exit(0);
  }

  switch (command.toLowerCase()) {
    case "create": {
      const name = process.argv[3];
      const role = process.argv[4] as UserRole;

      if (!name || !role) {
        console.error("❌ Usage: npm run user:manage create <name> <role>");
        console.log(`   Available roles: ${VALID_ROLES.join(", ")}`);
        process.exit(1);
      }

      await createUser(name, role);
      break;
    }

    case "delete": {
      const email = process.argv[3];

      if (!email) {
        console.error("❌ Usage: npm run user:manage delete <email>");
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
        console.error("❌ Usage: npm run user:manage update <email> <field> <value>");
        console.log("   Valid fields: name, role, active, email");
        process.exit(1);
      }

      await updateUser(email, field, value);
      break;
    }

    case "list": {
      await listUsers();
      break;
    }

    default:
      console.error(`❌ Unknown command: ${command}`);
      console.log("   Valid commands: create, delete, update, list");
      process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
