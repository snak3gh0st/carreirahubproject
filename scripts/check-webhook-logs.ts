import { prisma } from "@/lib/db";

async function main() {
  // Check recent webhook logs
  const webhookLogs = await prisma.integrationLog.findMany({
    where: {
      OR: [
        { service: 'QUICKBOOKS', action: { contains: 'WEBHOOK' } },
        { service: 'quickbooks', action: { contains: 'webhook' } },
      ],
      createdAt: {
        gte: new Date(Date.now() - 48 * 60 * 60 * 1000)
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  console.log('\n=== Recent QuickBooks Webhook Logs (Last 48h) ===\n');

  if (webhookLogs.length === 0) {
    console.log('⚠️  NO webhook logs found in the last 48 hours!');
    console.log('This suggests webhooks are not being received or processed.\n');
  } else {
    webhookLogs.forEach(log => {
      const date = log.createdAt.toISOString();
      console.log(`[${date}] ${log.service} - ${log.action}`);
      console.log(`  Status: ${log.status}`);
      if (log.error) console.log(`  Error: ${log.error}`);
      console.log('---');
    });
  }

  // Check if webhook secret is configured
  const config = await prisma.systemConfig.findUnique({
    where: { id: 'system' }
  });

  console.log('\n=== Webhook Configuration ===\n');
  console.log('Webhook secret configured:', !!config?.quickbooks_webhook_secret);
  console.log('Environment webhook token:', !!process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN);

  await prisma.$disconnect();
}

main().catch(console.error);
