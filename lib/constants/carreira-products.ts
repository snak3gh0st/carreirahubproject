export type ProductCategory = "MENTORIA" | "COMBO" | "AVULSO" | "CONSULTORIA";

export type PaymentRule =
  | "AVISTA_ONLY"      // no installments allowed
  | "MAX_2X_MIN_300"   // up to 2x, min $300/installment
  | "MENTORIA_PRESET"; // 3 preset options: à vista / 30% down+Nx / Nx no down (max 12x)

export interface CarreiraProduct {
  id: string;
  qbItemId: string;       // QuickBooks item ID used in invoice line items
  name: string;
  category: ProductCategory;
  officialPrice: number;  // price from Tabela de Valores (overrides QB price)
  paymentRule: PaymentRule;
  maxInstallments?: number;
  description?: string;
}

export const CARREIRA_CATALOG: CarreiraProduct[] = [
  // ── Programas de Mentoria ───────────────────────────────────────────────
  {
    id: "mentoria-early-career",
    qbItemId: "28",
    name: "Programa Early Career",
    category: "MENTORIA",
    officialPrice: 2000,
    paymentRule: "MENTORIA_PRESET",
    maxInstallments: 12,
    description: "Programa de mentoria — nível Early Career (oficial $2,500)",
  },
  {
    id: "mentoria-pass",
    qbItemId: "1010000261",
    name: "Programa Pass",
    category: "MENTORIA",
    officialPrice: 3000,
    paymentRule: "MENTORIA_PRESET",
    maxInstallments: 12,
    description: "Programa de mentoria — nível Pass (oficial $3,500)",
  },
  {
    id: "mentoria-advanced",
    qbItemId: "19",
    name: "Programa Pass Advanced",
    category: "MENTORIA",
    officialPrice: 4000,
    paymentRule: "MENTORIA_PRESET",
    maxInstallments: 12,
    description: "Programa de mentoria — nível Advanced (oficial $4,500)",
  },

  // ── Combo Sessão Bússola + Construção de Material ───────────────────────
  {
    id: "combo-early-career",
    qbItemId: "26",
    name: "Combo Early Career",
    category: "COMBO",
    officialPrice: 750,
    paymentRule: "MAX_2X_MIN_300",
    maxInstallments: 2,
    description: "Sessão Bússola + Construção de Material — Early Career",
  },
  {
    id: "combo-pass",
    qbItemId: "26",
    name: "Combo Pass",
    category: "COMBO",
    officialPrice: 1050,
    paymentRule: "MAX_2X_MIN_300",
    maxInstallments: 2,
    description: "Sessão Bússola + Construção de Material — Pass",
  },
  {
    id: "combo-advanced",
    qbItemId: "26",
    name: "Combo Advanced",
    category: "COMBO",
    officialPrice: 1650,
    paymentRule: "MAX_2X_MIN_300",
    maxInstallments: 2,
    description: "Sessão Bússola + Construção de Material — Advanced",
  },

  // ── Produtos Avulsos ────────────────────────────────────────────────────
  {
    id: "avulso-bussola",
    qbItemId: "1010000251",
    name: "Sessão Bússola",
    category: "AVULSO",
    officialPrice: 300,
    paymentRule: "AVISTA_ONLY",
    maxInstallments: 0,
  },
  {
    id: "avulso-ingles",
    qbItemId: "1010000051",
    name: "Teste de Inglês",
    category: "AVULSO",
    officialPrice: 90,
    paymentRule: "AVISTA_ONLY",
    maxInstallments: 0,
  },
  {
    id: "avulso-mock",
    qbItemId: "1010000101",
    name: "Mock Interview",
    category: "AVULSO",
    officialPrice: 197,
    paymentRule: "AVISTA_ONLY",
    maxInstallments: 0,
  },
  {
    id: "avulso-analise-gravada",
    qbItemId: "1010000262",
    name: "Análise de Entrevista Gravada",
    category: "AVULSO",
    officialPrice: 297,
    paymentRule: "AVISTA_ONLY",
    maxInstallments: 0,
  },
  {
    id: "avulso-analise-vagas",
    qbItemId: "1010000241",
    name: "Análise de Vagas",
    category: "AVULSO",
    officialPrice: 297,
    paymentRule: "AVISTA_ONLY",
    maxInstallments: 0,
  },
  {
    id: "avulso-negociacao",
    qbItemId: "1010000122",
    name: "Negociação de Salário",
    category: "AVULSO",
    officialPrice: 187,
    paymentRule: "AVISTA_ONLY",
    maxInstallments: 0,
  },
  {
    id: "avulso-treinamento",
    qbItemId: "1010000141",
    name: "Treinamento de Entrevista",
    category: "AVULSO",
    officialPrice: 447,
    paymentRule: "AVISTA_ONLY",
    maxInstallments: 0,
  },
  {
    id: "avulso-treinamento-advanced",
    qbItemId: "1010000151",
    name: "Treinamento de Entrevista (Advanced)",
    category: "AVULSO",
    officialPrice: 557,
    paymentRule: "AVISTA_ONLY",
    maxInstallments: 0,
  },

  // ── Consultoria Informativa ─────────────────────────────────────────────
  {
    id: "consultoria-thais",
    qbItemId: "1010000201",
    name: "Consultoria — Thais Mei",
    category: "CONSULTORIA",
    officialPrice: 700,
    paymentRule: "AVISTA_ONLY",
    maxInstallments: 0,
    description: "Consultoria Informativa (1h) com Thais Mei",
  },
  {
    id: "consultoria-team",
    qbItemId: "22",
    name: "Consultoria — Time Carreira",
    category: "CONSULTORIA",
    officialPrice: 397,
    paymentRule: "AVISTA_ONLY",
    maxInstallments: 0,
    description: "Consultoria Informativa (1h) com o time Carreira USA",
  },
];

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  MENTORIA: "Programas de Mentoria",
  COMBO: "Combo (Bússola + Material)",
  AVULSO: "Produtos Avulsos",
  CONSULTORIA: "Consultoria Informativa",
};

export const CATEGORY_ORDER: ProductCategory[] = [
  "MENTORIA",
  "COMBO",
  "AVULSO",
  "CONSULTORIA",
];

export function getProductsByCategory(searchTerm = ""): Array<{
  category: ProductCategory;
  label: string;
  products: CarreiraProduct[];
}> {
  const lower = searchTerm.toLowerCase();
  return CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    products: CARREIRA_CATALOG.filter(
      (p) =>
        p.category === cat &&
        (lower === "" || p.name.toLowerCase().includes(lower))
    ),
  })).filter((g) => g.products.length > 0);
}
