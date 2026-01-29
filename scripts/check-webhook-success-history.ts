import { prisma } from "@/lib/db";

async function main() {
  // Check for successful webhook processing
  const successfulWebhooks = await prisma.integrationLog.findMany({
    where: {
      service: 'QUICKBOOKS',
      action: 'WEBHOOK_ACCEPTED',
      status: 'SUCCESS'
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  console.log('\n=== Successful QuickBooks Webhooks (Last 10) ===\n');

  if (successfulWebhooks.length === 0) {
    console.log('⚠️  NO successful webhook processing found EVER!');
    console.log('This suggests the webhook has NEVER worked correctly.\n');
  } else {
    successfulWebhooks.forEach(log => {
      const date = log.createdAt.toISOString();
      console.log(`[${date}] ${log.action} - ${log.status}`);
    });
  }

  // Check when errors started
  const firstError = await prisma.integrationLog.findFirst({
    where: {
      service: 'QUICKBOOKS',
      action: 'WEBHOOK_ACCEPT_ERROR',
      status: 'ERROR',
      error: 'Failed to extract event ID from payload'
    },
    orderBy: { createdAt: 'asc' }
  });

  if (firstError) {
    console.log('\n=== First Event ID Error ===');
    console.log(`Date: ${firstError.createdAt.toISOString()}`);
    console.log(`This is when the error first appeared.\n`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
