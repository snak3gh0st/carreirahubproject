import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const files = [
  "app/ops/students/[enrollmentId]/StudentProfileClient.tsx",
  "app/ops/students/[enrollmentId]/OpsStudentAiPanel.tsx",
  "app/ops/students/[enrollmentId]/OpsStudentDigisacPanel.tsx",
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

test("ops exposes Digisac conversations in sidebar and customer profile", () => {
  const sidebar = fs.readFileSync("components/ops/ops-sidebar.tsx", "utf8");
  const roleConfig = fs.readFileSync("lib/sidebar/role-config.ts", "utf8");
  const profile = fs.readFileSync("app/ops/students/[enrollmentId]/StudentProfileClient.tsx", "utf8");

  assert.match(sidebar, /\/ops\/digisac/);
  assert.match(roleConfig, /\/ops\/digisac/);
  assert.match(profile, /OpsStudentDigisacPanel/);
  assert.ok(fs.existsSync("app/ops/digisac/page.tsx"));
  assert.ok(fs.existsSync("components/ops/digisac/OpsDigisacInbox.tsx"));
});

test("customer profile has command-center UI and customer portal labels", () => {
  const source = fs.readFileSync("app/ops/students/[enrollmentId]/StudentProfileClient.tsx", "utf8");

  assert.match(source, /Ações rápidas/);
  assert.match(source, /Ver portal do cliente/);
  assert.match(source, /Publicação no portal do cliente/);
  assert.match(source, /MetricTile/);
});

test("ops portal preview reuses the real hub client home view", () => {
  const preview = fs.readFileSync("app/ops/students/[enrollmentId]/portal-preview/page.tsx", "utf8");
  const hubPage = fs.readFileSync("app/hub/page.tsx", "utf8");
  const sharedView = fs.readFileSync("components/hub/HubHomeView.tsx", "utf8");

  assert.match(preview, /HubHomeView/);
  assert.match(preview, /readOnly/);
  assert.match(hubPage, /HubHomeView/);
  assert.match(sharedView, /JobSearchQuickAdd/);
  assert.doesNotMatch(preview, /prisma\.invoice\.findMany/);
  assert.doesNotMatch(preview, /opsDocuments/);
});

test("ops forms section exposes submitted answers and uploaded form files", () => {
  const source = fs.readFileSync("app/ops/students/[enrollmentId]/FormsSection.tsx", "utf8");

  assert.match(source, /answers/);
  assert.match(source, /Ver respostas e arquivos enviados/);
  assert.match(source, /api\/storage\/local/);
  assert.match(source, /dashboard\/forms\/submissions/);
});

test("ops has a first-class forms center linked from navigation and customer profile", () => {
  const sidebar = fs.readFileSync("components/ops/ops-sidebar.tsx", "utf8");
  const roleConfig = fs.readFileSync("lib/sidebar/role-config.ts", "utf8");
  const profileForms = fs.readFileSync("app/ops/students/[enrollmentId]/FormsSection.tsx", "utf8");

  assert.ok(fs.existsSync("app/ops/forms/page.tsx"));
  assert.match(sidebar, /\/ops\/forms/);
  assert.match(roleConfig, /\/ops\/forms/);
  assert.doesNotMatch(roleConfig, /href: "\/dashboard\/forms"/);
  assert.match(profileForms, /\/ops\/forms\?customerId=/);
});

test("ops forms center renders answers and file downloads without leaving ops", () => {
  const source = fs.readFileSync("app/ops/forms/page.tsx", "utf8");

  assert.match(source, /FORM_TEMPLATES/);
  assert.match(source, /searchParams/);
  assert.match(source, /api\/storage\/local/);
  assert.match(source, /renderAnswerValue/);
  assert.match(source, /mentorshipEnrollments/);
});
