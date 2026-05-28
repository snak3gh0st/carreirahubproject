import assert from "node:assert/strict";
import test from "node:test";

import { buildAnexoETabs } from "../lib/services/docusign-anexo-e";

function selectedSet(tabs: { checkboxTabs: { tabLabel: string; selected: string }[] }) {
  return new Set(tabs.checkboxTabs.filter((t) => t.selected === "true").map((t) => t.tabLabel));
}

function textMap(tabs: { textTabs: { tabLabel: string; value: string }[] }) {
  return Object.fromEntries(tabs.textTabs.map((t) => [t.tabLabel, t.value]));
}

test("compass session alone marks only compass_session", () => {
  const tabs = buildAnexoETabs({ services: [{ kind: "COMPASS" }] });
  assert.deepEqual(selectedSet(tabs), new Set(["compass_session"]));
});

test("material full with compass marks construction + with_compass + full + compass", () => {
  const tabs = buildAnexoETabs({
    services: [
      { kind: "MATERIAL", withCompass: true, materialType: "FULL" },
    ],
  });
  assert.deepEqual(
    selectedSet(tabs),
    new Set([
      "compass_session",
      "material_construction",
      "material_with_compass",
      "material_full",
    ]),
  );
});

test("material resume without compass excludes compass_session", () => {
  const tabs = buildAnexoETabs({
    services: [
      { kind: "MATERIAL", withCompass: false, materialType: "RESUME" },
    ],
  });
  const s = selectedSet(tabs);
  assert.ok(s.has("material_construction"));
  assert.ok(s.has("material_without_compass"));
  assert.ok(s.has("material_resume"));
  assert.ok(!s.has("compass_session"));
  assert.ok(!s.has("material_with_compass"));
  assert.ok(!s.has("material_full"));
});

test("mock interview qty 2 marks mock_qty_2 only (not 1 or 3)", () => {
  const tabs = buildAnexoETabs({
    services: [{ kind: "MOCK_INTERVIEW", quantity: 2 }],
  });
  const s = selectedSet(tabs);
  assert.ok(s.has("mock_interview"));
  assert.ok(s.has("mock_qty_2"));
  assert.ok(!s.has("mock_qty_1"));
  assert.ok(!s.has("mock_qty_3"));
  assert.ok(!s.has("mock_qty_other"));
});

test("mock interview qty 5 marks mock_qty_other and fills mock_qty_custom text", () => {
  const tabs = buildAnexoETabs({
    services: [{ kind: "MOCK_INTERVIEW", quantity: 5 }],
  });
  assert.ok(selectedSet(tabs).has("mock_qty_other"));
  assert.equal(textMap(tabs).mock_qty_custom, "5");
});

test("payment lump sum + QB sets the right checkboxes and values", () => {
  const tabs = buildAnexoETabs({
    services: [{ kind: "COMPASS" }],
    payment: {
      valueUsd: "500.00",
      valueWords: "five hundred",
      modality: "LUMP_SUM",
      method: "QB",
    },
  });
  const s = selectedSet(tabs);
  const t = textMap(tabs);
  assert.ok(s.has("e_pay_lump"));
  assert.ok(s.has("e_pay_qb"));
  assert.ok(!s.has("e_pay_installment"));
  assert.equal(t.e_value_usd, "500.00");
  assert.equal(t.e_value_words, "five hundred");
});

test("payment installment 6x with other method fills installments and other value", () => {
  const tabs = buildAnexoETabs({
    services: [{ kind: "COMPASS" }],
    payment: {
      valueUsd: "1,800.00",
      modality: "INSTALLMENT",
      installments: 6,
      method: "OTHER",
      otherMethodValue: "PayPal",
    },
  });
  const s = selectedSet(tabs);
  const t = textMap(tabs);
  assert.ok(s.has("e_pay_installment"));
  assert.ok(s.has("e_pay_other"));
  assert.equal(t.e_installments, "6");
  assert.equal(t.e_pay_other_value, "PayPal");
});

test("every known checkbox label appears in output (false when not selected)", () => {
  const tabs = buildAnexoETabs({ services: [{ kind: "COMPASS" }] });
  const labels = tabs.checkboxTabs.map((t) => t.tabLabel);
  // Spot check a handful of labels that should always be present
  for (const expected of [
    "compass_session",
    "material_full",
    "mock_qty_1",
    "salary_negotiation",
    "e_pay_qb",
    "e_pay_wire",
  ]) {
    assert.ok(labels.includes(expected), `missing label ${expected}`);
  }
});
