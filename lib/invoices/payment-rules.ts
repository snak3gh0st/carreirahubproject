import {
  CARREIRA_CATALOG,
  type CarreiraProduct,
  type PaymentRule,
} from "@/lib/constants/carreira-products";

const DEFAULT_MAX_INSTALLMENTS = 24;
const MIN_COMBO_INSTALLMENT_AMOUNT = 300;

export interface PaymentPolicy {
  paymentRule: PaymentRule | null;
  maxInstallments: number;
}

export function getProductsFromCatalogProductIds(
  catalogProductIds: Array<string | undefined>
): CarreiraProduct[] {
  return catalogProductIds
    .map((productId) =>
      productId
        ? CARREIRA_CATALOG.find((product) => product.id === productId)
        : undefined
    )
    .filter(Boolean) as CarreiraProduct[];
}

export function getPaymentPolicyForProducts(
  products: CarreiraProduct[]
): PaymentPolicy {
  if (products.length === 0) {
    return {
      paymentRule: null,
      maxInstallments: DEFAULT_MAX_INSTALLMENTS,
    };
  }

  const mentorshipProducts = products.filter(
    (product) => product.paymentRule === "MENTORIA_PRESET"
  );

  if (mentorshipProducts.length > 0) {
    return {
      paymentRule: "MENTORIA_PRESET",
      maxInstallments: Math.max(
        ...mentorshipProducts.map(
          (product) => product.maxInstallments ?? DEFAULT_MAX_INSTALLMENTS
        )
      ),
    };
  }

  const comboProducts = products.filter(
    (product) => product.paymentRule === "MAX_2X_MIN_300"
  );

  if (comboProducts.length > 0) {
    return {
      paymentRule: "MAX_2X_MIN_300",
      maxInstallments: Math.min(
        ...comboProducts.map((product) => product.maxInstallments ?? 2)
      ),
    };
  }

  return {
    paymentRule: "AVISTA_ONLY",
    maxInstallments: 0,
  };
}

export function validatePaymentSelection(input: {
  products: CarreiraProduct[];
  entryAmount: number;
  installments: number;
  totalAmount: number;
}): PaymentPolicy {
  const policy = getPaymentPolicyForProducts(input.products);

  if (policy.paymentRule === "AVISTA_ONLY") {
    if (input.entryAmount > 0 || input.installments > 0) {
      throw new Error(
        "Este produto é somente à vista — não é permitido parcelamento."
      );
    }

    return policy;
  }

  if (input.installments > policy.maxInstallments) {
    const productLabel =
      policy.paymentRule === "MAX_2X_MIN_300" ? "Combo" : "Mentoria";
    throw new Error(
      `${productLabel}: máximo de ${policy.maxInstallments} parcelas.`
    );
  }

  if (policy.paymentRule === "MAX_2X_MIN_300" && input.installments > 0) {
    const remaining = Math.max(0, input.totalAmount - input.entryAmount);
    const perInstallment = remaining / input.installments;
    if (perInstallment < MIN_COMBO_INSTALLMENT_AMOUNT) {
      throw new Error(
        `Parcela mínima de $300 (atual: $${perInstallment.toFixed(2)}).`
      );
    }
  }

  return policy;
}
