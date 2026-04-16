import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { prisma } = require("../lib/db");
  const customers = await prisma.customer.findMany({
    where: { name: { contains: 'Murilo', mode: 'insensitive' } },
    include: { createdBy: { select: { id: true, name: true, email: true, role: true } } },
  });
  for (const c of customers) {
    console.log('--- CUSTOMER ---');
    console.log({
      id: c.id,
      name: c.name,
      email: c.email,
      createdAt: c.createdAt,
      createdById: c.createdById,
      createdBy: c.createdBy,
    });
    const invoices = await prisma.invoice.findMany({
      where: { customerId: c.id },
      include: { owner: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
    for (const inv of invoices) {
      console.log('  INVOICE:', {
        id: inv.id,
        number: inv.invoiceNumber,
        amount: inv.amount.toString(),
        status: inv.status,
        dealId: inv.dealId,
        ownerId: inv.ownerId,
        owner: inv.owner,
        createdAt: inv.createdAt,
      });
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
