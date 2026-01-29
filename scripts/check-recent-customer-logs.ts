import { prisma } from "@/lib/db";

async function main() {
  const logs = await prisma.integrationLog.findMany({
    where: {
      OR: [
        { action: { contains: 'customer' } },
        { service: 'quickbooks', action: { contains: 'customer' } }
      ],
      createdAt: {
        gte: new Date(Date.now() - 48 * 60 * 60 * 1000)
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 30
  });

  console.log('\n=== Recent Customer Integration Logs (Last 48h) ===\n');

  if (logs.length === 0) {
    console.log('No customer-related logs found in the last 48 hours.');
  } else {
    logs.forEach(log => {
      const date = log.createdAt.toISOString();
      console.log(`[${date}] ${log.service} - ${log.action}`);
      console.log(`  Status: ${log.status}`);
      if (log.error) console.log(`  Error: ${log.error}`);
      if (log.payload) {
        const payload = typeof log.payload === 'string' ? JSON.parse(log.payload) : log.payload;
        console.log(`  Payload:`, JSON.stringify(payload, null, 2).substring(0, 200));
      }
      console.log('---');
    });
  }

  await prisma.$disconnect();
}

main().catch(console.error);
