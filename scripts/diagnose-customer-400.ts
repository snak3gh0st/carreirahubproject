import { prisma } from "@/lib/db";

async function main() {
  const errorLogs = await prisma.integrationLog.findMany({
    where: {
      service: 'quickbooks',
      action: '/customer',
      status: 'ERROR',
      createdAt: {
        gte: new Date(Date.now() - 48 * 60 * 60 * 1000)
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  console.log('\n=== QuickBooks Customer 400 Errors ===\n');

  for (const log of errorLogs) {
    console.log(`\n[${log.createdAt.toISOString()}]`);
    console.log(`Error: ${log.error}`);

    if (log.payload) {
      const payload = typeof log.payload === 'string' ? JSON.parse(log.payload) : log.payload;
      console.log('Full Payload:');
      console.log(JSON.stringify(payload, null, 2));
    }

    if (log.metadata) {
      const metadata = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata;
      console.log('Metadata:');
      console.log(JSON.stringify(metadata, null, 2));
    }

    console.log('---');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
