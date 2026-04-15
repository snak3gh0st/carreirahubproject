import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

test("dedicated hub AI page files exist", () => {
  const paths = [
    "app/dashboard/financial/ai/page.tsx",
    "app/dashboard/commercial/ai/page.tsx",
    "app/dashboard/operational/ai/page.tsx",
    "app/dashboard/admin/ai/page.tsx",
  ];

  for (const path of paths) {
    assert.ok(fs.existsSync(path), `${path} should exist`);
  }
});

test("legacy dashboard ai page redirects using getAiRouteForRole", () => {
  const source = read("app/dashboard/ai/page.tsx");

  assert.match(source, /getAiRouteForRole/);
  assert.match(source, /redirect\(/);
});

test("ChatPanel passes hub in conversation detail fetch and send body", () => {
  const source = read("components/ai/ChatPanel.tsx");

  assert.match(source, /conversations\/\$\{conversationId\}\?hub=\$\{hub\}/);
  assert.match(source, /const extraBody = \{ conversationId, pathname, params, hub \}/);
  assert.match(source, /fetch\('\/api\/dashboard\/ai\/conversations'/);
  assert.match(source, /body:\s*JSON\.stringify\(\{ hub, title: text\.slice\(0, 80\) \}\)/);
  assert.match(source, /onNewConversationId\?\.\(newConversationId\)/);
  assert.match(source, /getSuggestionsForRole\(role,\s*hub\)/);
});

test("ConversationSidebar passes hub in list and delete requests", () => {
  const source = read("components/ai/ConversationSidebar.tsx");

  assert.match(source, /fetch\(`\/api\/dashboard\/ai\/conversations\?hub=\$\{hub\}`\)/);
  assert.match(source, /method:\s*'DELETE'/);
  assert.match(source, /fetch\(`\/api\/dashboard\/ai\/conversations\?id=\$\{conversationId\}&hub=\$\{hub\}`/);
  assert.match(source, /window\.confirm/);
});
