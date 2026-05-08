import { CARREIRA_CATALOG } from "@/lib/constants/carreira-products";

export interface QuickBooksInvoiceCatalogItem {
  id: string;
  name: string;
  unitPrice?: number | null;
  type?: string;
}

export interface RequestedInvoiceQuickBooksItem {
  catalogProductId?: string;
  serviceItemId: string;
  description?: string;
}

function normalizeItemName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function singularizeWords(value: string): string {
  return value
    .split(" ")
    .map((token) =>
      token.length > 3 && token.endsWith("s") ? token.slice(0, -1) : token
    )
    .join(" ");
}

function getExpectedItemName(item: RequestedInvoiceQuickBooksItem): string {
  const catalogProduct = item.catalogProductId
    ? CARREIRA_CATALOG.find((product) => product.id === item.catalogProductId)
    : undefined;

  return catalogProduct?.name || item.description || item.serviceItemId;
}

function findRelatedItems(
  expectedName: string,
  quickbooksItems: QuickBooksInvoiceCatalogItem[]
): QuickBooksInvoiceCatalogItem[] {
  const normalizedExpectedName = normalizeItemName(expectedName);
  const singularExpectedName = singularizeWords(normalizedExpectedName);
  const expectedTokens = singularExpectedName.split(" ").filter(Boolean);

  return quickbooksItems.filter((item) => {
    const normalizedItemName = normalizeItemName(item.name);
    const singularItemName = singularizeWords(normalizedItemName);

    if (normalizedItemName.includes(normalizedExpectedName)) {
      return true;
    }

    if (singularItemName.includes(singularExpectedName)) {
      return true;
    }

    return expectedTokens.every((token) => singularItemName.includes(token));
  });
}

export function resolveInvoiceQuickBooksItemRefs(
  requestedItems: RequestedInvoiceQuickBooksItem[],
  quickbooksItems: QuickBooksInvoiceCatalogItem[]
): RequestedInvoiceQuickBooksItem[] {
  const quickbooksItemsById = new Map(
    quickbooksItems.map((item) => [String(item.id), item])
  );

  return requestedItems.map((item) => {
    const currentItem = quickbooksItemsById.get(String(item.serviceItemId));
    if (currentItem) {
      return item;
    }

    const expectedName = getExpectedItemName(item);
    const normalizedExpectedName = normalizeItemName(expectedName);
    const exactNameMatches = quickbooksItems.filter(
      (quickbooksItem) =>
        normalizeItemName(quickbooksItem.name) === normalizedExpectedName
    );

    if (exactNameMatches.length === 1) {
      return {
        ...item,
        serviceItemId: exactNameMatches[0].id,
      };
    }

    const relatedItems = findRelatedItems(expectedName, quickbooksItems);
    if (relatedItems.length > 0) {
      const relatedNames = relatedItems
        .slice(0, 5)
        .map((quickbooksItem) => quickbooksItem.name)
        .join(", ");

      throw new Error(
        `O item "${expectedName}" nao possui um mapeamento unico no QuickBooks. Itens relacionados encontrados: ${relatedNames}. Atualize o catalogo antes de criar a invoice.`
      );
    }

    throw new Error(
      `O item "${expectedName}" nao existe no QuickBooks com o ID ${item.serviceItemId}. Atualize o catalogo antes de criar a invoice.`
    );
  });
}
