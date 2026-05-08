import assert from "node:assert/strict";

import { CARREIRA_CATALOG } from "../lib/constants/carreira-products";
import { getCatalogProductUnitPrice } from "../lib/invoices/catalog-price";

const materialIProduct = CARREIRA_CATALOG.find((product) => product.id === "combo-material-i");

assert.ok(materialIProduct, "combo-material-i should exist in the catalog");

assert.equal(
  getCatalogProductUnitPrice(materialIProduct, { unitPrice: 950 }),
  950,
  "QuickBooks unit price should take precedence over the catalog fallback"
);

assert.equal(
  getCatalogProductUnitPrice(materialIProduct, { unitPrice: null }),
  materialIProduct.officialPrice,
  "Catalog official price should be used when QuickBooks has no unit price"
);

assert.equal(
  getCatalogProductUnitPrice(materialIProduct, undefined),
  materialIProduct.officialPrice,
  "Catalog official price should be used when QuickBooks item is unavailable"
);

console.log("catalog-price.test.ts passed");
