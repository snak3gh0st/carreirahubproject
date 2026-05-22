import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("operational student intelligence tool is registered for the AI copilot", () => {
  const index = fs.readFileSync("lib/ai/tools/index.ts", "utf8");
  const tool = fs.readFileSync("lib/ai/tools/ops/get-student-operational-intelligence.ts", "utf8");

  assert.match(index, /getStudentOperationalIntelligence/);
  assert.match(tool, /name:\s*"getStudentOperationalIntelligence"/);
  assert.match(tool, /comments:\s*\{/);
  assert.match(tool, /mockInterviews:\s*\{/);
  assert.match(tool, /applicationsAndInterviews:\s*\{/);
  assert.match(tool, /byConductor/);
});

test("student profile embeds the operational AI panel with enrollment context", () => {
  const profile = fs.readFileSync("app/ops/students/[enrollmentId]/StudentProfileClient.tsx", "utf8");
  const panel = fs.readFileSync("app/ops/students/[enrollmentId]/OpsStudentAiPanel.tsx", "utf8");

  assert.match(profile, /<OpsStudentAiPanel/);
  assert.match(panel, /hub:\s*"operational"/);
  assert.match(panel, /params:\s*\{\s*enrollmentId\s*\}/);
  assert.match(panel, /opsContext/);
  assert.match(panel, /getStudentOperationalIntelligence/);
});

test("operational prompt allows detailed student analysis when asked", () => {
  const prompt = fs.readFileSync("lib/ai/prompts/system.pt-br.ts", "utf8");

  assert.match(prompt, /getStudentOperationalIntelligence/);
  assert.match(prompt, /pergunta analítica ou específica/);
  assert.doesNotMatch(prompt, /Quando houver um aluno selecionado, responda em no maximo 6 linhas curtas/);
});
