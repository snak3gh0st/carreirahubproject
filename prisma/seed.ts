import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PHASES = [
  { sortOrder: 1,  key: "bastao",          label: "Passagem de Bastão", slaDays: 3  },
  { sortOrder: 2,  key: "cadastro",         label: "Cadastro",           slaDays: 3  },
  { sortOrder: 3,  key: "teste_de_ingles",  label: "Teste de Inglês",    slaDays: 7  },
  { sortOrder: 4,  key: "onboarding",       label: "Onboarding",         slaDays: 7  },
  { sortOrder: 5,  key: "board",            label: "Board",              slaDays: 7  },
  { sortOrder: 6,  key: "bussola",          label: "Bússola",            slaDays: 14 },
  { sortOrder: 7,  key: "raio_x",           label: "Raio X",             slaDays: 14 },
  { sortOrder: 8,  key: "material",         label: "Material",           slaDays: 21 },
  { sortOrder: 9,  key: "devolutiva",       label: "Devolutiva",         slaDays: 7  },
  { sortOrder: 10, key: "ongoing",          label: "Ongoing",            slaDays: 60 },
  { sortOrder: 11, key: "renovacao",        label: "Renovação",          slaDays: 14 },
];

async function main() {
  console.log("Seeding mentorship phases...");
  for (const phase of PHASES) {
    await prisma.mentorshipPhase.upsert({
      where: { key: phase.key },
      update: { label: phase.label, sortOrder: phase.sortOrder, slaDays: phase.slaDays },
      create: phase,
    });
  }
  console.log(`Seeded ${PHASES.length} mentorship phases.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
