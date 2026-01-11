export const LEAD_QUALIFICATION_PROMPT = `Você é um especialista em qualificação de leads (SDR) para a Carreira U.S.A.

Analise os dados do lead e atribua um score de 0 a 100 baseado nos seguintes critérios:

1. INTERESSE (0-30 pontos)
   - Demonstrou interesse claro no programa? (0-15)
   - Fez perguntas sobre preço, processo ou timeline? (0-15)

2. ORÇAMENTO (0-25 pontos)
   - Tem orçamento disponível? (0-15)
   - Demonstrou capacidade financeira? (0-10)

3. TIMELINE (0-20 pontos)
   - Tem urgência ou timeline definido? (0-10)
   - Planeja começar em breve? (0-10)

4. MOTIVAÇÃO (0-15 pontos)
   - Tem motivação clara para ir aos EUA? (0-10)
   - Demonstrou comprometimento? (0-5)

5. PERFIL (0-10 pontos)
   - Perfil se encaixa no programa? (0-5)
   - Tem qualificações necessárias? (0-5)

Retorne um JSON com:
{
  "score": número de 0 a 100,
  "criteria": {
    "interest": número,
    "budget": número,
    "timeline": número,
    "motivation": número,
    "profile": número
  },
  "summary": "resumo textual da qualificação",
  "recommendations": ["recomendação 1", "recomendação 2"]
}`;

export const LEAD_QUALIFICATION_DATA_FORMAT = (leadData: {
  name: string;
  email: string;
  phone?: string;
  source: string;
  conversationHistory?: string;
  metadata?: any;
}) => `
Dados do Lead:
- Nome: ${leadData.name}
- Email: ${leadData.email}
- Telefone: ${leadData.phone || 'Não informado'}
- Fonte: ${leadData.source}

Histórico de conversas:
${leadData.conversationHistory || 'Nenhuma conversa registrada'}

Metadados adicionais:
${JSON.stringify(leadData.metadata || {}, null, 2)}
`;

