import type { Language } from "@/lib/i18n/hub";

export interface RealtimeEnglishTestBriefCopy {
  title: string;
  summary: string;
  bullets: string[];
  resultBelowNote: string;
}

export function getRealtimeEnglishTestBriefCopy(
  language: Language
): RealtimeEnglishTestBriefCopy {
  if (language === "pt-BR") {
    return {
      title: "Antes da analise oral",
      summary:
        "Esta e uma analise oral conduzida por uma teacher de ingles. Nao e uma mock interview e nao exige preparo de entrevista de emprego.",
      bullets: [
        "A teacher vai avaliar fluencia, pronuncia, gramatica, vocabulario, compreensao e clareza.",
        "Voce pode receber perguntas simples, pequenas situacoes do dia a dia, opinioes e pedidos para explicar ideias em ingles.",
        "Se nao entender, pode pedir para repetir ou simplificar a pergunta.",
        "A AI conduz a conversa e so encerra quando tiver evidencia suficiente para gerar a analise.",
      ],
      resultBelowNote:
        "Quando a conversa terminar, aguarde alguns segundos: o audio pode parar enquanto o resultado e gerado, e o resultado aparece logo abaixo da sala.",
    };
  }

  return {
    title: "Before starting the oral test",
    summary:
      "This is an oral English analysis led by an English teacher. It is not a mock interview and does not require job interview preparation.",
    bullets: [
      "The teacher will evaluate fluency, pronunciation, grammar, vocabulary, comprehension, and clarity.",
      "You may receive simple questions, everyday situations, opinions, and prompts to explain ideas in English.",
      "If you do not understand, you can ask the teacher to repeat or simplify the question.",
      "The AI leads the conversation and only ends when it has enough evidence to generate the analysis.",
    ],
    resultBelowNote:
      "When the conversation ends, wait a few seconds: audio may stop while the result is generated, and the result appears just below the room.",
  };
}
