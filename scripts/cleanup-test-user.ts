import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const DRY_RUN = process.argv[2] !== '--execute';

async function main() {
  const { prisma } = await import('@/lib/db');

  const customer = await prisma.customer.findFirst({
    where: { email: 'loureiropaulo@gmail.com' },
    select: { id: true, name: true, email: true },
  });

  if (!customer) {
    console.log('Customer not found for loureiropaulo@gmail.com');
    await prisma.$disconnect();
    return;
  }

  console.log(`Customer: ${customer.id} — ${customer.name} <${customer.email}>`);

  const [contracts, invoices] = await Promise.all([
    prisma.contract.findMany({ where: { customerId: customer.id }, select: { id: true, docusign_env_id: true, status: true } }),
    prisma.invoice.findMany({ where: { customerId: customer.id }, select: { id: true, invoiceNumber: true, amount: true, status: true } }),
  ]);

  console.log(`\nContracts (${contracts.length}):`);
  for (const c of contracts) console.log(`  ${c.id} env=${c.docusign_env_id} status=${c.status}`);

  console.log(`\nInvoices (${invoices.length}):`);
  for (const i of invoices) console.log(`  ${i.id} #${i.invoiceNumber} $${i.amount} ${i.status}`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Run with --execute to delete.');
    await prisma.$disconnect();
    return;
  }

  console.log('\nDeleting...');
  const [dc, di] = await Promise.all([
    prisma.contract.deleteMany({ where: { customerId: customer.id } }),
    prisma.invoice.deleteMany({ where: { customerId: customer.id } }),
  ]);
  console.log(`✓ Deleted ${dc.count} contracts, ${di.count} invoices`);

  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
