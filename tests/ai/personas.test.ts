import test from "node:test";
import assert from "node:assert/strict";
import {
  PERSONAS,
  getPersonasForHub,
  getPersonaBySlug,
} from "../../lib/ai/personas.ts";

test("PERSONAS has exactly one entry per hub in V1", () => {
  const hubs = PERSONAS.map((p) => p.hub).sort();
  assert.deepEqual(hubs, ["admin", "commercial", "financial", "operational"]);
});

test("getPersonasForHub returns personas for that hub only", () => {
  const fin = getPersonasForHub("financial");
  assert.equal(fin.length, 1);
  assert.equal(fin[0].slug, "raio-x-financeiro");
});

test("getPersonasForHub returns empty array for unknown hub", () => {
  assert.deepEqual(getPersonasForHub("unknown" as any), []);
});

test("getPersonaBySlug finds known persona", () => {
  const p = getPersonaBySlug("ceo-brief");
  assert.ok(p);
  assert.equal(p?.hub, "admin");
});

test("getPersonaBySlug returns null for unknown slug", () => {
  assert.equal(getPersonaBySlug("nope"), null);
});

test("every persona has required fields", () => {
  for (const p of PERSONAS) {
    assert.ok(p.slug, `slug missing on persona`);
    assert.ok(p.label, `label missing on ${p.slug}`);
    assert.ok(p.tagline, `tagline missing on ${p.slug}`);
    assert.ok(p.icon, `icon missing on ${p.slug}`);
    assert.ok(p.defaultPrompt, `defaultPrompt missing on ${p.slug}`);
    assert.ok(p.deltaPrompt, `deltaPrompt missing on ${p.slug}`);
    assert.ok(Array.isArray(p.toolWhitelist), `toolWhitelist not array on ${p.slug}`);
    assert.ok(p.cacheTtlMinutes > 0, `cacheTtlMinutes must be >0 on ${p.slug}`);
  }
});

test("every persona's systemAppend includes the BLUF contract sentinels", () => {
  // Catches regressions where someone overrides systemAppend and forgets to
  // concatenate BLUF_CONTRACT — length alone would not detect this.
  for (const p of PERSONAS) {
    assert.ok(p.systemAppend.includes("TL;DR"), `TL;DR missing in ${p.slug}`);
    assert.ok(p.systemAppend.includes("Ação recomendada"), `"Ação recomendada" missing in ${p.slug}`);
    assert.ok(p.systemAppend.includes("Nunca invente números"), `anti-hallucination rule missing in ${p.slug}`);
  }
});
