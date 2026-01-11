/**
 * Script TypeScript para popular o banco de dados com dados de teste
 * 
 * Uso: npx tsx scripts/seed-test-data.ts [--clear]
 * 
 * Opções:
 *   --clear: Limpa todos os dados antes de popular (use com cuidado!)
 */

import { PrismaClient, UserRole, LeadStatus, LeadSource, DealStatus, InvoiceStatus, ConversationStatus, MessageRole } from "@prisma/client";

const prisma = new PrismaClient();

// Dados de exemplo
const testUsers = [
  { email: "admin@carreirausa.com", name: "Admin User", role: "ADMIN" as UserRole },
  { email: "sdr@carreirausa.com", name: "SDR User", role: "SDR" as UserRole },
  { email: "sales@carreirausa.com", name: "Sales User", role: "SALES" as UserRole },
  { email: "finance@carreirausa.com", name: "Finance User", role: "FINANCE" as UserRole },
  { email: "support@carreirausa.com", name: "Support User", role: "SUPPORT" as UserRole },
];

const testLeads = [
  {
    email: "joao.silva@example.com",
    name: "João Silva",
    phone: "+5511999999999",
    source: "WEBSITE" as LeadSource,
    status: "NEW" as LeadStatus,
  },
  {
    email: "maria.santos@example.com",
    name: "Maria Santos",
    phone: "+5511888888888",
    source: "WHATSAPP" as LeadSource,
    status: "QUALIFYING" as LeadStatus,
  },
  {
    email: "pedro.oliveira@example.com",
    name: "Pedro Oliveira",
    phone: "+5511777777777",
    source: "REFERRAL" as LeadSource,
    status: "QUALIFIED" as LeadStatus,
    qualificationScore: 85,
  },
  {
    email: "ana.costa@example.com",
    name: "Ana Costa",
    phone: "+5511666666666",
    source: "SOCIAL_MEDIA" as LeadSource,
    status: "QUALIFIED" as LeadStatus,
    qualificationScore: 92,
  },
  {
    email: "carlos.ferreira@example.com",
    name: "Carlos Ferreira",
    phone: "+5511555555555",
    source: "WEBSITE" as LeadSource,
    status: "UNQUALIFIED" as LeadStatus,
    qualificationScore: 35,
  },
  {
    email: "julia.rodrigues@example.com",
    name: "Julia Rodrigues",
    phone: "+5511444444444",
    source: "WHATSAPP" as LeadSource,
    status: "CONVERTED" as LeadStatus,
    qualificationScore: 95,
  },
  {
    email: "roberto.alves@example.com",
    name: "Roberto Alves",
    phone: "+5511333333333",
    source: "REFERRAL" as LeadSource,
    status: "LOST" as LeadStatus,
    qualificationScore: 40,
  },
];

const testCustomers = [
  {
    email: "empresa.alpha@example.com",
    name: "Empresa Alpha Ltda",
    phone: "+5511222222222",
    document: "12.345.678/0001-90",
    pipedrive_id: 1001,
    quickbooks_id: "QB-001",
    stripe_id: "cus_alpha123",
  },
  {
    email: "empresa.beta@example.com",
    name: "Empresa Beta S.A.",
    phone: "+5511111111111",
    document: "98.765.432/0001-10",
    pipedrive_id: 1002,
    quickbooks_id: "QB-002",
    stripe_id: "cus_beta456",
  },
  {
    email: "julia.rodrigues@example.com",
    name: "Julia Rodrigues",
    phone: "+5511444444444",
    document: "123.456.789-00",
    pipedrive_id: 1003,
  },
];

async function clearDatabase() {
  console.log("🗑️  Limpando dados existentes...");
  
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.leadQualification.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.integrationLog.deleteMany();
  
  // Manter apenas o usuário admin padrão
  await prisma.user.deleteMany({
    where: {
      email: { not: "admin@carreirausa.com" },
    },
  });
  
  console.log("   ✅ Dados limpos!\n");
}

async function seed() {
  const shouldClear = process.argv.includes("--clear");
  
  if (shouldClear) {
    await clearDatabase();
  }

  console.log("🌱 Iniciando seed do banco de dados...\n");

  try {
    // 1. Criar Usuários
    console.log("👥 Criando usuários...");
    const users: Record<string, any> = {};
    for (const userData of testUsers) {
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: { ...userData, active: true },
        create: { ...userData, active: true },
      });
      users[userData.role] = user;
      console.log(`   ✅ ${user.name} (${user.role})`);
    }

    // 2. Criar Leads
    console.log("\n📋 Criando leads...");
    const leads: any[] = [];
    for (const leadData of testLeads) {
      const lead = await prisma.lead.upsert({
        where: { email: leadData.email },
        update: leadData,
        create: {
          ...leadData,
          qualifiedBy:
            leadData.status === "QUALIFIED" || leadData.status === "CONVERTED"
              ? { connect: { id: users.SDR.id } }
              : undefined,
          qualifiedAt:
            leadData.status === "QUALIFIED" || leadData.status === "CONVERTED"
              ? new Date()
              : undefined,
          qualificationData:
            leadData.qualificationScore
              ? {
                  score: leadData.qualificationScore,
                  criteria: {
                    budget: "confirmed",
                    authority: "decision_maker",
                    need: "high",
                    timeline: "30_days",
                  },
                }
              : undefined,
        },
      });
      leads.push(lead);
      console.log(`   ✅ ${lead.name} (${lead.status})`);
    }

    // 3. Criar Customers
    console.log("\n🏢 Criando customers...");
    const customers: any[] = [];
    for (const customerData of testCustomers) {
      const customer = await prisma.customer.upsert({
        where: { email: customerData.email },
        update: customerData,
        create: customerData,
      });
      customers.push(customer);
      console.log(`   ✅ ${customer.name}`);
    }

    // 4. Criar Deals
    console.log("\n💰 Criando deals...");
    const deals: any[] = [];
    
    // Deal 1: Vinculado a customer e lead convertido
    const convertedLead = leads.find((l) => l.status === "CONVERTED");
    if (convertedLead && customers[2]) {
      const deal1 = await prisma.deal.create({
        data: {
          title: "Pacote Premium - Julia Rodrigues",
          value: 15000.0,
          currency: "USD",
          status: "OPEN" as DealStatus,
          pipedrive_deal_id: 2001,
          customer: { connect: { id: customers[2].id } },
          owner: { connect: { id: users.SALES.id } },
          convertedFromLead: { connect: { id: convertedLead.id } },
        },
      });
      deals.push(deal1);
      console.log(`   ✅ ${deal1.title} (${deal1.status})`);

      // Atualizar lead com deal convertido
      await prisma.lead.update({
        where: { id: convertedLead.id },
        data: {
          convertedToDealId: deal1.id,
          convertedAt: new Date(),
        },
      });
    }

    // Deal 2: Vinculado a customer Alpha
    const deal2 = await prisma.deal.create({
      data: {
        title: "Contrato Anual - Empresa Alpha",
        value: 50000.0,
        currency: "USD",
        status: "WON" as DealStatus,
        pipedrive_deal_id: 2002,
        customer: { connect: { id: customers[0].id } },
        owner: { connect: { id: users.SALES.id } },
      },
    });
    deals.push(deal2);
    console.log(`   ✅ ${deal2.title} (${deal2.status})`);

    // Deal 3: Vinculado a customer Beta
    const deal3 = await prisma.deal.create({
      data: {
        title: "Pacote Básico - Empresa Beta",
        value: 8000.0,
        currency: "USD",
        status: "OPEN" as DealStatus,
        pipedrive_deal_id: 2003,
        customer: { connect: { id: customers[1].id } },
        owner: { connect: { id: users.SALES.id } },
      },
    });
    deals.push(deal3);
    console.log(`   ✅ ${deal3.title} (${deal3.status})`);

    // Deal 4: Perdido
    const deal4 = await prisma.deal.create({
      data: {
        title: "Oportunidade Perdida",
        value: 12000.0,
        currency: "USD",
        status: "LOST" as DealStatus,
        pipedrive_deal_id: 2004,
        customer: { connect: { id: customers[0].id } },
        owner: { connect: { id: users.SALES.id } },
      },
    });
    deals.push(deal4);
    console.log(`   ✅ ${deal4.title} (${deal4.status})`);

    // 5. Criar Invoices
    console.log("\n🧾 Criando invoices...");
    const invoices: any[] = [];
    
    // Invoice 1: Paga
    const invoice1 = await prisma.invoice.create({
      data: {
        invoiceNumber: "INV-2024-001",
        amount: 15000.0,
        dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 dias atrás
        status: "PAID" as InvoiceStatus,
        quickbooks_invoice_id: "QB-INV-001",
        stripe_invoice_id: "in_stripe_001",
        deal: { connect: { id: deals[0].id } },
        customer: { connect: { id: deals[0].customerId } },
      },
    });
    invoices.push(invoice1);
    console.log(`   ✅ ${invoice1.invoiceNumber} (${invoice1.status})`);

    // Invoice 2: Vencida
    const invoice2 = await prisma.invoice.create({
      data: {
        invoiceNumber: "INV-2024-002",
        amount: 50000.0,
        dueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 dias atrás
        status: "OVERDUE" as InvoiceStatus,
        quickbooks_invoice_id: "QB-INV-002",
        deal: { connect: { id: deals[1].id } },
        customer: { connect: { id: deals[1].customerId } },
      },
    });
    invoices.push(invoice2);
    console.log(`   ✅ ${invoice2.invoiceNumber} (${invoice2.status})`);

    // Invoice 3: Enviada
    const invoice3 = await prisma.invoice.create({
      data: {
        invoiceNumber: "INV-2024-003",
        amount: 8000.0,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias no futuro
        status: "SENT" as InvoiceStatus,
        quickbooks_invoice_id: "QB-INV-003",
        deal: { connect: { id: deals[2].id } },
        customer: { connect: { id: deals[2].customerId } },
      },
    });
    invoices.push(invoice3);
    console.log(`   ✅ ${invoice3.invoiceNumber} (${invoice3.status})`);

    // Invoice 4: Rascunho
    const invoice4 = await prisma.invoice.create({
      data: {
        invoiceNumber: "INV-2024-004",
        amount: 12000.0,
        dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 dias no futuro
        status: "DRAFT" as InvoiceStatus,
        deal: { connect: { id: deals[3].id } },
        customer: { connect: { id: deals[3].customerId } },
      },
    });
    invoices.push(invoice4);
    console.log(`   ✅ ${invoice4.invoiceNumber} (${invoice4.status})`);

    // 6. Criar Conversations e Messages
    console.log("\n💬 Criando conversations e messages...");
    
    // Conversation 1: Ativa
    const conversation1 = await prisma.conversation.create({
      data: {
        lead: { connect: { id: leads[1].id } }, // Maria Santos
        status: "ACTIVE" as ConversationStatus,
        title: "Consulta sobre serviços",
        summary: "Lead interessado em conhecer os serviços oferecidos",
        messages: {
          create: [
            {
              lead: { connect: { id: leads[1].id } },
              role: "USER" as MessageRole,
              content: "Olá, gostaria de saber mais sobre os serviços de imigração.",
            },
            {
              lead: { connect: { id: leads[1].id } },
              role: "ASSISTANT" as MessageRole,
              content: "Olá! Fico feliz em ajudar. Nossos serviços incluem...",
            },
            {
              lead: { connect: { id: leads[1].id } },
              role: "USER" as MessageRole,
              content: "Qual o investimento necessário?",
            },
          ],
        },
      },
    });
    console.log(`   ✅ Conversation: ${conversation1.title}`);

    // Conversation 2: Escalada
    const conversation2 = await prisma.conversation.create({
      data: {
        lead: { connect: { id: leads[2].id } }, // Pedro Oliveira
        status: "ESCALATED" as ConversationStatus,
        title: "Dúvidas sobre processo",
        summary: "Lead com dúvidas técnicas que requerem atenção especializada",
        escalatedAt: new Date(),
        escalatedTo: { connect: { id: users.SUPPORT.id } },
        messages: {
          create: [
            {
              lead: { connect: { id: leads[2].id } },
              role: "USER" as MessageRole,
              content: "Tenho algumas dúvidas sobre o processo de visto.",
            },
            {
              lead: { connect: { id: leads[2].id } },
              role: "ASSISTANT" as MessageRole,
              content: "Vou escalar sua dúvida para nosso time especializado.",
            },
          ],
        },
      },
    });
    console.log(`   ✅ Conversation: ${conversation2.title} (escalada)`);

    // Conversation 3: Resolvida
    const conversation3 = await prisma.conversation.create({
      data: {
        lead: { connect: { id: leads[3].id } }, // Ana Costa
        status: "RESOLVED" as ConversationStatus,
        title: "Informações sobre documentação",
        summary: "Lead obteve todas as informações necessárias",
        messages: {
          create: [
            {
              lead: { connect: { id: leads[3].id } },
              role: "USER" as MessageRole,
              content: "Quais documentos são necessários?",
            },
            {
              lead: { connect: { id: leads[3].id } },
              role: "ASSISTANT" as MessageRole,
              content: "Os documentos necessários incluem passaporte, formulários...",
            },
            {
              lead: { connect: { id: leads[3].id } },
              role: "USER" as MessageRole,
              content: "Perfeito, obrigada pela ajuda!",
            },
          ],
        },
      },
    });
    console.log(`   ✅ Conversation: ${conversation3.title} (resolvida)`);

    // 7. Criar LeadQualifications
    console.log("\n📊 Criando lead qualifications...");
    
    const qualifiedLeads = leads.filter(
      (l) => l.status === "QUALIFIED" || l.status === "CONVERTED"
    );
    
    for (const lead of qualifiedLeads) {
      const qualification = await prisma.leadQualification.create({
        data: {
          lead: { connect: { id: lead.id } },
          score: lead.qualificationScore || 80,
          criteria: {
            budget: "confirmed",
            authority: "decision_maker",
            need: "high",
            timeline: "30_days",
            fit: "good",
          },
          qualifiedBy: { connect: { id: users.SDR.id } },
          notes: `Lead qualificado com score de ${lead.qualificationScore || 80}/100. Interesse confirmado e orçamento disponível.`,
        },
      });
      console.log(`   ✅ Qualification para ${lead.name} (score: ${qualification.score})`);
    }

    // 8. Criar IntegrationLogs
    console.log("\n📝 Criando integration logs...");
    
    const logs = [
      {
        service: "PIPEDRIVE",
        action: "WEBHOOK_RECEIVED",
        status: "SUCCESS",
        payload: { deal_id: 2001, event: "deal.created" },
      },
      {
        service: "QUICKBOOKS",
        action: "INVOICE_CREATED",
        status: "SUCCESS",
        payload: { invoice_id: "QB-INV-001" },
      },
      {
        service: "AI_SERVICE",
        action: "LEAD_QUALIFIED",
        status: "SUCCESS",
        payload: { lead_id: leads[2].id, score: 85 },
      },
      {
        service: "STRIPE",
        action: "PAYMENT_PROCESSED",
        status: "SUCCESS",
        payload: { invoice_id: "in_stripe_001", amount: 15000 },
      },
      {
        service: "PIPEDRIVE",
        action: "SYNC_ERROR",
        status: "ERROR",
        error: "Connection timeout",
        retryCount: 2,
      },
    ];

    for (const logData of logs) {
      const log = await prisma.integrationLog.create({
        data: logData,
      });
      console.log(`   ✅ Log: ${log.service} - ${log.action} (${log.status})`);
    }

    // Resumo
    console.log("\n✅ Seed concluído com sucesso!\n");
    console.log("📊 Resumo:");
    console.log(`   👥 Usuários: ${testUsers.length}`);
    console.log(`   📋 Leads: ${leads.length}`);
    console.log(`   🏢 Customers: ${customers.length}`);
    console.log(`   💰 Deals: ${deals.length}`);
    console.log(`   🧾 Invoices: ${invoices.length}`);
    console.log(`   💬 Conversations: 3`);
    console.log(`   📊 Qualifications: ${qualifiedLeads.length}`);
    console.log(`   📝 Integration Logs: ${logs.length}\n`);

  } catch (error) {
    console.error("❌ Erro durante o seed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar seed
seed()
  .then(() => {
    console.log("🎉 Processo concluído!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Erro fatal:", error);
    process.exit(1);
  });
