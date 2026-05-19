import {
  CARREIRA_CATALOG,
  type CarreiraProduct,
  type PaymentRule,
} from "@/lib/constants/carreira-products";

const DEFAULT_MAX_INSTALLMENTS = 12;

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
  products: CarreiraProduct[],
  _totalAmount = 0
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
      maxInstallments: Math.min(
        DEFAULT_MAX_INSTALLMENTS,
        Math.max(
          ...mentorshipProducts.map(
            (product) => product.maxInstallments ?? DEFAULT_MAX_INSTALLMENTS
          )
        )
      ),
    };
  }

  return {
    paymentRule: "FLEXIBLE",
    maxInstallments: Math.min(
      DEFAULT_MAX_INSTALLMENTS,
      Math.min(
        ...products.map(
          (product) => product.maxInstallments ?? DEFAULT_MAX_INSTALLMENTS
        )
      )
    ),
  };
}

export function validatePaymentSelection(input: {
  products: CarreiraProduct[];
  entryAmount: number;
  installments: number;
  totalAmount: number;
}): PaymentPolicy {
  const policy = getPaymentPolicyForProducts(input.products, input.totalAmount);
  const maxInstallments = getMaxInstallmentsForEntry(
    policy,
    input.entryAmount
  );

  if (input.installments > maxInstallments) {
    throw new Error(
      input.entryAmount > 0
        ? `Máximo de ${maxInstallments} parcelas para esta seleção porque a entrada conta como primeira parcela.`
        : `Máximo de ${maxInstallments} parcelas para esta seleção.`
    );
  }

  return policy;
}

export function getMaxInstallmentsForEntry(
  policy: PaymentPolicy,
  entryAmount: number
): number {
  if (entryAmount > 0) {
    return Math.max(0, policy.maxInstallments - 1);
  }

  return policy.maxInstallments;
}
