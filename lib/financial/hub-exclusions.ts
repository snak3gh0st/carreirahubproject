type CustomerIdentity = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
};

export const FINANCIAL_HUB_EXCLUDED_CUSTOMER_EMAILS = [
  "abraaobs@gmail.com",
  "acarolinattc@gmail.com",
  "adijarmirjunior@gmail.com",
  "adribatisti@gmail.com",
  "alberto.nascimento.mba@gmail.com",
  "alexandretella@hotmail.com",
  "alexsdr@gmail.com",
  "angela_demari@hotmail.com",
  "araujo.neto@att.net",
  "arycaa@gmail.com",
  "carolinaceciliausa@outlook.com",
  "casasanta.sarah@gmail.com",
  "ferreirajose@uol.com.br",
  "felipe3k@gmail.com",
  "fernandamoraes.adv@gmail.com",
  "floragois@outlook.com",
  "francis.rimoli@gmail.com",
  "hortbgagliardi@gmail.com",
  "jvgaidojunior@gmail.com",
  "kriskindred@gmail.com",
  "laudarescamila_engmec@hotmail.com",
  "lincolnpsenajr@gmail.com",
  "mafebra11@gmail.com",
  "marcelagmendes@outlook.com",
  "morais_mf@yahoo.com",
  "nararbruno@outlook.com",
  "reginaldobastos@icloud.com",
  "rooseweltfeitosa@gmail.com",
  "sanchessgeo@gmail.com",
  "saraivahugo2@gmail.com",
  "tfabreti@gmail.com",
  "vihgbaker@gmail.com",
] as const;

const EXCLUDED_CUSTOMER_EMAILS = new Set<string>(
  FINANCIAL_HUB_EXCLUDED_CUSTOMER_EMAILS.map((email) => email.toLowerCase()),
);

const EXCLUDED_CUSTOMER_NAME_KEYS = [
  "abraao b barbosa",
  "adijarmir rodrigues da silva junior",
  "adriana batisti da silva",
  "alberto francisco do nascimento ju",
  "alberto lemos araujo neto",
  "alex de matos nickerson",
  "alexandre augusto fiori de tella",
  "ana carolina tomas tenorio",
  "angela de mari roberto",
  "aryane da silva souza",
  "bruna gagliardi",
  "camila laudares silva",
  "cecilia carolina",
  "felipe augusto lustosa rosario",
  "flora moreira gois",
  "francis nunes rimoli",
  "geovana sanches",
  "hugo saraiva veras",
  "indianara bruno",
  "itala marcela gomes mendes da silva",
  "joao vicente gaido junior",
  "jose luiz rodrigues ferreira",
  "kristopher scott kindred",
  "lincoln pereira sena junior",
  "maria fernanda alves brasiliense",
  "maria fernanda reis de moraes",
  "michel de freitas morais",
  "reginaldo celso bastos",
  "roosewelt feitosa e silva",
  "sarah queiroz casasanta gama",
  "tatiana guimaraes fabreti",
  "vitoria backer",
] as const;

export function normalizeFinancialHubCustomerName(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function isFinancialHubExcludedCustomer(customer: CustomerIdentity | null | undefined): boolean {
  if (!customer) {
    return false;
  }

  const email = customer.email?.trim().toLowerCase();
  if (email && EXCLUDED_CUSTOMER_EMAILS.has(email)) {
    return true;
  }

  const name = normalizeFinancialHubCustomerName(customer.name);
  if (!name) {
    return false;
  }

  return EXCLUDED_CUSTOMER_NAME_KEYS.some((excludedName) => {
    const key = normalizeFinancialHubCustomerName(excludedName);
    return name === key || name.startsWith(`${key} `);
  });
}

export function filterFinancialHubExcludedCustomers<T extends {
  customerId?: string | null;
  customer?: CustomerIdentity | null;
}>(rows: T[], excludedCustomerIds: Iterable<string> = []): T[] {
  const excludedIds = new Set(excludedCustomerIds);

  return rows.filter((row) => {
    if (row.customerId && excludedIds.has(row.customerId)) {
      return false;
    }

    return !isFinancialHubExcludedCustomer(row.customer);
  });
}

export function buildCustomerIdExclusionWhere(excludedCustomerIds: string[]) {
  return excludedCustomerIds.length > 0
    ? { customerId: { notIn: excludedCustomerIds } }
    : {};
}

export function buildNullableCustomerIdExclusionWhere(excludedCustomerIds: string[]) {
  return excludedCustomerIds.length > 0
    ? {
        OR: [
          { customerId: null },
          { customerId: { notIn: excludedCustomerIds } },
        ],
      }
    : {};
}

export function buildFinancialHubInvoiceWhere<T extends Record<string, unknown>>(
  where: T,
  excludedCustomerIds: string[],
): T & ReturnType<typeof buildCustomerIdExclusionWhere> {
  return {
    ...where,
    ...buildCustomerIdExclusionWhere(excludedCustomerIds),
  };
}
