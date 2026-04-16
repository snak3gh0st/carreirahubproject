import { prisma } from "@/lib/db";

async function main() {
  const logs = await prisma.integrationLog.findMany({
    where: { service: "hub-payment" },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  for (const l of logs) {
    console.log("---");
    console.log(`[${l.createdAt.toISOString()}] ${l.action} — ${l.status}`);
    if (l.error) console.log("  error :", l.error);
    if (l.errorCategory) console.log("  cat   :", l.errorCategory, l.errorCode);
    if (l.payload) console.log("  payload:", JSON.stringify(l.payload).slice(0, 400));
    if (l.metadata) console.log("  meta  :", JSON.stringify(l.metadata).slice(0, 400));
  }

  console.log("\n=== quickbooks logs (create_card / create_bank_account) ===");
  const qbLogs = await prisma.integrationLog.findMany({
    where: {
      service: "quickbooks",
      OR: [
        { action: { contains: "card" } },
        { action: { contains: "bank" } },
        { action: { contains: "tokens" } },
        { action: { contains: "customers/" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 15,
  });
  for (const l of qbLogs) {
    console.log("---");
    console.log(`[${l.createdAt.toISOString()}] ${l.action} — ${l.status}`);
    if (l.error) console.log("  error :", l.error);
    if (l.payload) console.log("  payload:", JSON.stringify(l.payload).slice(0, 400));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
