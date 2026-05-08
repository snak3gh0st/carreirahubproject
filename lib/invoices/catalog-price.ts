import type { CarreiraProduct } from "@/lib/constants/carreira-products";

export interface QuickBooksCatalogItemPrice {
  unitPrice?: number | null;
}

export function getCatalogProductUnitPrice(
  product: CarreiraProduct,
  quickbooksItem?: QuickBooksCatalogItemPrice | null
): number {
  const quickbooksUnitPrice = quickbooksItem?.unitPrice;

  if (typeof quickbooksUnitPrice === "number" && Number.isFinite(quickbooksUnitPrice)) {
    return quickbooksUnitPrice;
  }

  return product.officialPrice;
}
