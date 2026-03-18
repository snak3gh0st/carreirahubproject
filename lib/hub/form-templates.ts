// ---------------------------------------------------------------------------
// Form Templates for the Client Hub
// ---------------------------------------------------------------------------

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "checkbox"
  | "file";

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  labelPt: string;
  required: boolean;
  options?: { value: string; label: string; labelPt: string }[];
}

export interface FormTemplate {
  id: string;
  title: string;
  titlePt: string;
  description: string;
  descriptionPt: string;
  fields: FormField[];
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const FORM_TEMPLATES: Record<string, FormTemplate> = {
  "onboarding-career": {
    id: "onboarding-career",
    title: "Career Onboarding Form",
    titlePt: "Formulario de Onboarding de Carreira",
    description:
      "Complete this form so we can start building your personalized career plan in the USA.",
    descriptionPt:
      "Preencha este formulario para que possamos comecar a construir seu plano de carreira personalizado nos EUA.",
    fields: [
      {
        id: "fullName",
        type: "text",
        label: "Full Name",
        labelPt: "Nome Completo",
        required: true,
      },
      {
        id: "dob",
        type: "date",
        label: "Date of Birth",
        labelPt: "Data de Nascimento",
        required: true,
      },
      {
        id: "phone",
        type: "text",
        label: "Phone Number",
        labelPt: "Numero de Telefone",
        required: true,
      },
      {
        id: "address",
        type: "text",
        label: "Address",
        labelPt: "Endereco",
        required: true,
      },
      {
        id: "resume",
        type: "file",
        label: "Resume / CV",
        labelPt: "Curriculo",
        required: true,
      },
      {
        id: "workExperience",
        type: "textarea",
        label: "Work Experience Summary",
        labelPt: "Resumo da Experiencia Profissional",
        required: false,
      },
      {
        id: "desiredRole",
        type: "text",
        label: "Desired Role in the USA",
        labelPt: "Cargo Desejado nos EUA",
        required: false,
      },
      {
        id: "linkedIn",
        type: "text",
        label: "LinkedIn Profile",
        labelPt: "Perfil do LinkedIn",
        required: false,
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the FormTemplate for the given slug, or `null` if it does not exist.
 */
export function getTemplate(slug: string): FormTemplate | null {
  return FORM_TEMPLATES[slug] ?? null;
}
