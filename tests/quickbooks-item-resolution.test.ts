import assert from "node:assert/strict";

import {
  resolveInvoiceQuickBooksItemRefs,
  type QuickBooksInvoiceCatalogItem,
} from "../lib/invoices/quickbooks-item-resolution";

const quickbooksItems: QuickBooksInvoiceCatalogItem[] = [
  { id: "94", name: "Teste de Inglês", unitPrice: 90, type: "Service" },
  { id: "69", name: "Análise de Vaga - Early Career", unitPrice: 447, type: "Service" },
  { id: "77", name: "Análise de Vaga - E-Level e M- Level", unitPrice: 447, type: "Service" },
  { id: "83", name: "Análise de Vaga  -  Advanced", unitPrice: 447, type: "Service" },
];

const resolvedItems = resolveInvoiceQuickBooksItemRefs(
  [
    {
      catalogProductId: "avulso-ingles",
      serviceItemId: "1010000051",
      description: "Teste de Inglês",
    },
  ],
  quickbooksItems
);

assert.equal(resolvedItems[0].serviceItemId, "94");

assert.throws(
  () =>
    resolveInvoiceQuickBooksItemRefs(
      [
        {
          catalogProductId: "avulso-analise-vagas",
          serviceItemId: "1010000241",
          description: "Análise de Vagas",
        },
      ],
      quickbooksItems
    ),
  /Análise de Vagas[\s\S]*Early Career[\s\S]*Advanced/i
);

console.log("quickbooks-item-resolution.test.ts passed");
