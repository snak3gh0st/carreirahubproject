/**
 * docusign-anexo-e.ts
 *
 * Pure helper that turns a structured "avulso" service request into the
 * `checkboxTabs` + `textTabs` that DocuSign expects for the Anexo E
 * template (DOCUSIGN_TEMPLATE_AVULSO).
 *
 * Convention: Data Labels follow the snake_case style already used in the
 * existing templates (no prefix). See docs/contracts/anexo-e-MAPPING.md.
 *
 * NOTE: this helper is intentionally NOT wired into createEnvelopeFromTemplate
 * yet. It will be wired once the AVULSO template has the matching checkbox
 * fields configured in DocuSign (current state: zero checkboxTabs). Until
 * then, callers can still use it safely — DocuSign silently ignores tabs
 * with labels that do not exist in the template.
 */

export type AnexoEMaterialType =
  | "FULL"
  | "RESUME"
  | "COVER_LETTER"
  | "LINKEDIN";

export type AnexoEServiceItem =
  | {
      kind: "COMPASS";
    }
  | {
      kind: "MATERIAL";
      withCompass: boolean;
      materialType: AnexoEMaterialType;
    }
  | {
      kind: "INTERVIEW_TRAINING";
    }
  | {
      kind: "MOCK_INTERVIEW";
      quantity: number;
    }
  | {
      kind: "SALARY_NEGOTIATION";
    };

export interface AnexoEPaymentSpec {
  /**
   * Numeric value as it should appear in the contract (e.g. "2,500.00").
   * The "e_value_words" tab is generated from this when not supplied.
   */
  valueUsd: string;
  /** Optional spelled-out value. If absent, kept empty. */
  valueWords?: string;
  /**
   * "LUMP_SUM" → marks `e_pay_lump`.
   * "INSTALLMENT" → marks `e_pay_installment` and fills `e_installments`.
   */
  modality: "LUMP_SUM" | "INSTALLMENT";
  installments?: number;
  /**
   * Payment method: marks one of e_pay_qb / e_pay_zelle / e_pay_wire / e_pay_other.
   * When "OTHER", also fills `e_pay_other_value` if provided.
   */
  method: "QB" | "ZELLE" | "WIRE" | "OTHER";
  otherMethodValue?: string;
}

export interface AnexoETabsInput {
  /** One or more avulso services in the same envelope. */
  services: AnexoEServiceItem[];
  /** Optional payment block for Anexo E's own 2.x section. */
  payment?: AnexoEPaymentSpec;
}

export interface DocusignCheckboxTab {
  tabLabel: string;
  selected: "true" | "false";
}

export interface DocusignTextTab {
  tabLabel: string;
  value: string;
}

export interface AnexoETabs {
  checkboxTabs: DocusignCheckboxTab[];
  textTabs: DocusignTextTab[];
}

const ALL_CHECKBOXES = [
  "compass_session",
  "material_construction",
  "material_with_compass",
  "material_without_compass",
  "material_full",
  "material_resume",
  "material_cover_letter",
  "material_linkedin",
  "interview_training",
  "mock_interview",
  "mock_qty_1",
  "mock_qty_2",
  "mock_qty_3",
  "mock_qty_other",
  "salary_negotiation",
  "e_pay_lump",
  "e_pay_installment",
  "e_pay_qb",
  "e_pay_zelle",
  "e_pay_wire",
  "e_pay_other",
] as const;

const MATERIAL_LABEL_BY_TYPE: Record<AnexoEMaterialType, string> = {
  FULL: "material_full",
  RESUME: "material_resume",
  COVER_LETTER: "material_cover_letter",
  LINKEDIN: "material_linkedin",
};

/**
 * Build the tabs payload for an Anexo E envelope.
 *
 * The resulting object can be merged into the existing
 * `templateRoles[clientRole].tabs` object of an envelopeDefinition.
 */
export function buildAnexoETabs(input: AnexoETabsInput): AnexoETabs {
  const selected = new Set<string>();
  const textTabs: DocusignTextTab[] = [];

  for (const service of input.services) {
    switch (service.kind) {
      case "COMPASS":
        selected.add("compass_session");
        break;
      case "MATERIAL":
        selected.add("material_construction");
        if (service.withCompass) {
          selected.add("material_with_compass");
          // a Compass session bundled with material implies the compass box too
          selected.add("compass_session");
        } else {
          selected.add("material_without_compass");
        }
        selected.add(MATERIAL_LABEL_BY_TYPE[service.materialType]);
        break;
      case "INTERVIEW_TRAINING":
        selected.add("interview_training");
        break;
      case "MOCK_INTERVIEW":
        selected.add("mock_interview");
        if (service.quantity === 1) selected.add("mock_qty_1");
        else if (service.quantity === 2) selected.add("mock_qty_2");
        else if (service.quantity === 3) selected.add("mock_qty_3");
        else {
          selected.add("mock_qty_other");
          textTabs.push({
            tabLabel: "mock_qty_custom",
            value: String(service.quantity),
          });
        }
        break;
      case "SALARY_NEGOTIATION":
        selected.add("salary_negotiation");
        break;
    }
  }

  if (input.payment) {
    const p = input.payment;
    textTabs.push({ tabLabel: "e_value_usd", value: p.valueUsd });
    textTabs.push({
      tabLabel: "e_value_words",
      value: p.valueWords ?? "",
    });

    if (p.modality === "LUMP_SUM") {
      selected.add("e_pay_lump");
    } else {
      selected.add("e_pay_installment");
      textTabs.push({
        tabLabel: "e_installments",
        value: String(p.installments ?? ""),
      });
    }

    switch (p.method) {
      case "QB":
        selected.add("e_pay_qb");
        break;
      case "ZELLE":
        selected.add("e_pay_zelle");
        break;
      case "WIRE":
        selected.add("e_pay_wire");
        break;
      case "OTHER":
        selected.add("e_pay_other");
        textTabs.push({
          tabLabel: "e_pay_other_value",
          value: p.otherMethodValue ?? "",
        });
        break;
    }
  }

  // Emit ALL known checkbox labels so unselected boxes are explicitly false.
  // DocuSign treats an absent tab as "use template default", which can be
  // surprising if a template author accidentally pre-checked a box.
  const checkboxTabs: DocusignCheckboxTab[] = ALL_CHECKBOXES.map((label) => ({
    tabLabel: label,
    selected: selected.has(label) ? "true" : "false",
  }));

  return { checkboxTabs, textTabs };
}
