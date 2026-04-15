import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

test("professional sidebar derives the visible AI entry from the user's hub", () => {
  const source = read("components/dashboard/professional-sidebar.tsx");

  assert.match(source, /getAiHubForRole/);
  assert.match(source, /label:\s*aiHub\.label/);
  assert.match(source, /href:\s*aiHub\.routePath/);
});

test("dashboard layout no longer mounts the generic ChatBubble", () => {
  const source = read("app/dashboard/layout.tsx");

  assert.doesNotMatch(source, /<ChatBubble/);
});
