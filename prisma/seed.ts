import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PHASES = [
  { sortOrder: 1,  key: "bastao",                        label: "Passagem de Bastão",              slaDays: 3  },
  { sortOrder: 2,  key: "cadastro",                       label: "Cadastro e Acessos",              slaDays: 3  },
  { sortOrder: 3,  key: "marcar_teste_ingles",            label: "Marcar Teste de Inglês",          slaDays: 3  },
  { sortOrder: 4,  key: "teste_de_ingles",                label: "Teste de Inglês",                 slaDays: 7  },
  { sortOrder: 5,  key: "passou_teste_ingles",            label: "Passou no Teste de Inglês",       slaDays: 2  },
  { sortOrder: 6,  key: "nao_passou_teste_ingles",        label: "Não passou no Teste de Inglês",   slaDays: 2  },
  { sortOrder: 7,  key: "marcar_onboarding",              label: "Marcar Onboarding",               slaDays: 3  },
  { sortOrder: 8,  key: "onboarding_marcado",             label: "Onboarding Marcado",              slaDays: 3  },
  { sortOrder: 9,  key: "onboarding",                     label: "Onboarding Realizado",            slaDays: 7  },
  { sortOrder: 10, key: "preparacao_board",               label: "Preparação do Board",             slaDays: 5  },
  { sortOrder: 11, key: "board",                          label: "Board",                           slaDays: 7  },
  { sortOrder: 12, key: "pode_marcar_bussola",            label: "Pode Marcar a Bússola",           slaDays: 3  },
  { sortOrder: 13, key: "bussola_marcada",                label: "Sessão Bússola Marcada",          slaDays: 5  },
  { sortOrder: 14, key: "bussola",                        label: "Sessão Bússola Realizada",        slaDays: 14 },
  { sortOrder: 15, key: "finalizar_board",                label: "Finalizar o Board",               slaDays: 5  },
  { sortOrder: 16, key: "marcar_raio_x",                  label: "Marcar Sessão Raio-X",            slaDays: 5  },
  { sortOrder: 17, key: "raio_x",                         label: "Sessão Raio-X Realizada",         slaDays: 14 },
  { sortOrder: 18, key: "construcao_material",            label: "Construção de Material",          slaDays: 21 },
  { sortOrder: 19, key: "material",                       label: "Em processo de revisão",           slaDays: 21 },
  { sortOrder: 20, key: "em_revisao",                     label: "Em Processo de Revisão",          slaDays: 10 },
  { sortOrder: 21, key: "realizar_devolutiva",            label: "Realizar Devolutiva",             slaDays: 5  },
  { sortOrder: 22, key: "devolutiva",                     label: "Devolutiva Feita",                slaDays: 7  },
  { sortOrder: 23, key: "suporte_15_min",                 label: "15 Minutos com o Suporte",        slaDays: 5  },
  { sortOrder: 24, key: "suporte_marcado",                label: "Marcado com o Suporte",           slaDays: 5  },
  { sortOrder: 25, key: "marcar_treinamento_entrevista",  label: "Marcar Treinamento de Entrevista", slaDays: 5  },
  { sortOrder: 26, key: "treinamento_entrevista",         label: "Treinamento de Entrevista",       slaDays: 10 },
  { sortOrder: 27, key: "treinamento_entrevista_marcado", label: "Treinamento de Entrevista Marcado", slaDays: 5  },
  { sortOrder: 28, key: "mock_interview_1",               label: "1ª Mock Interview",               slaDays: 10 },
  { sortOrder: 29, key: "mock_interview_2",               label: "2ª Mock Interview",               slaDays: 10 },
  { sortOrder: 30, key: "ongoing",                        label: "Ongoing / Aplicações",            slaDays: 60 },
  { sortOrder: 31, key: "aguardando_recolocacao",         label: "Aguardando Recolocação",          slaDays: 60 },
  { sortOrder: 32, key: "precisa_renovar",                label: "Precisa Renovar",                 slaDays: 7  },
  { sortOrder: 33, key: "audio_renovacao_enviado",        label: "Áudio de Renovação Enviado",      slaDays: 7  },
  { sortOrder: 34, key: "renovacao",                      label: "Renovação",                       slaDays: 14 },
  { sortOrder: 35, key: "mentoria_encerrada",             label: "Mentoria Encerrada",              slaDays: 1  },
];

async function main() {
  console.log("Seeding mentorship phases...");
  await prisma.$transaction(async (tx) => {
    await tx.mentorshipPhase.updateMany({
      data: { sortOrder: { increment: 1000 } },
    });

    for (const phase of PHASES) {
      await tx.mentorshipPhase.upsert({
        where: { key: phase.key },
        update: { label: phase.label, sortOrder: phase.sortOrder, slaDays: phase.slaDays },
        create: phase,
      });
    }
  });
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
