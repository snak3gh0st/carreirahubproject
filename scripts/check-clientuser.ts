import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { prisma } = require("../lib/db");
  const bcrypt = require("bcryptjs");

  const cu = await prisma.clientUser.findUnique({
    where: { email: "loureiropaulo@gmail.com" },
  });

  if (!cu) {
    console.log("✗ NÃO encontrado");
    await prisma.$disconnect();
    return;
  }

  console.log("ClientUser:");
  console.log("  id:", cu.id);
  console.log("  email:", cu.email);
  console.log("  mustResetPw:", cu.mustResetPw);
  console.log("  tempExpires:", cu.tempPasswordExpiresAt);
  console.log("  lockedUntil:", cu.lockedUntil);
  console.log("  failedLoginCount:", cu.failedLoginCount);
  console.log("  hash:", cu.passwordHash);
  console.log("");

  // Test a password — pass as CLI arg: npx tsx scripts/check-clientuser.ts <password>
  const testPassword = process.argv[2];
  if (testPassword) {
    const valid = await bcrypt.compare(testPassword, cu.passwordHash);
    console.log(`bcrypt.compare('<arg>', hash) = ${valid}`);
  } else {
    console.log("(skip bcrypt check — pass password as first arg to test it)");
  }

  // Which DB?
  const result = await prisma.$queryRaw`SELECT current_database(), inet_server_addr()::text as host`;
  console.log("DB connection:", result);

  await prisma.$disconnect();
}
main().catch((e) => {
  console.error("✗", e);
  process.exit(1);
});
