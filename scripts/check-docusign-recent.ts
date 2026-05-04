import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { prisma } = await import('@/lib/db');

  // Contratos recentes com info do deal/invoice para ver qual template foi usado
  const contracts = await prisma.contract.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      docusign_env_id: true,
      status: true,
      signerName: true,
      signerEmail: true,
      createdAt: true,
      deal: {
        select: {
          id: true,
          title: true,
          invoices: {
            take: 1,
            select: {
              id: true,
              lineItems: true,
            }
          }
        }
      }
    }
  });

  console.log(`=== ${contracts.length} contratos recentes ===\n`);
  for (const c of contracts) {
    console.log(`[${c.createdAt.toISOString().slice(0, 16)}] ${c.signerName} <${c.signerEmail}>`);
    console.log(`  envelope: ${c.docusign_env_id}`);
    console.log(`  deal: "${c.deal?.title}"`);
    const lineItems = c.deal?.invoices?.[0]?.lineItems as any;
    console.log(`  lineItems: ${JSON.stringify(lineItems)?.slice(0, 200)}`);
    console.log('');
  }

  await prisma.$disconnect();
}
main();
