import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const files = [
  "app/ops/students/[enrollmentId]/StudentProfileClient.tsx",
  "app/ops/students/[enrollmentId]/OpsStudentAiPanel.tsx",
  "app/ops/students/[enrollmentId]/OperationalHubSection.tsx",
  "app/ops/students/[enrollmentId]/FormsSection.tsx",
  "app/ops/students/[enrollmentId]/portal-preview/page.tsx",
];

test("operational customer profile visible copy uses cliente instead of aluno", () => {
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, />[^<]*(aluno|Aluno)[^<]*</, `${file} still renders aluno copy`);
  }
});

test("customer profile has command-center UI and customer portal labels", () => {
  const source = fs.readFileSync("app/ops/students/[enrollmentId]/StudentProfileClient.tsx", "utf8");

  assert.match(source, /Ações rápidas/);
  assert.match(source, /Ver portal do cliente/);
  assert.match(source, /Publicação no portal do cliente/);
  assert.match(source, /MetricTile/);
});
