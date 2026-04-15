import test from "node:test";
import assert from "node:assert/strict";
import { filterToolsByWhitelist, toolRegistry } from "../../lib/ai/tools/index.ts";

test("filterToolsByWhitelist keeps only listed names", () => {
  const filtered = filterToolsByWhitelist(toolRegistry, ["getCurrentDate", "getInvoices"]);
  const names = filtered.map((t) => t.name).sort();
  assert.deepEqual(names, ["getCurrentDate", "getInvoices"]);
});

test("filterToolsByWhitelist ignores unknown whitelisted names without throwing", () => {
  const filtered = filterToolsByWhitelist(toolRegistry, ["getCurrentDate", "doesNotExist"]);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, "getCurrentDate");
});

test("filterToolsByWhitelist with empty whitelist returns empty array", () => {
  const filtered = filterToolsByWhitelist(toolRegistry, []);
  assert.equal(filtered.length, 0);
});
