import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

test("assistant bubbles use a wider reading surface and richer prose styling", () => {
  const source = read("components/ai/MessageBubble.tsx");

  assert.match(source, /max-w-\[min\(920px,92%\)\]/);
  assert.match(source, /prose-headings:mb-3/);
  assert.match(source, /prose-p:leading-7/);
});

test("message list centers content in a calmer reading column", () => {
  const source = read("components/ai/MessageList.tsx");

  assert.match(source, /mx-auto/);
  assert.match(source, /max-w-\[1100px\]/);
});

test("tool call cards share the upgraded surface treatment", () => {
  const source = read("components/ai/ToolCallCard.tsx");

  assert.match(source, /rounded-\[22px\]/);
  assert.match(source, /shadow-\[0_10px_30px_rgba\(23,53,44,0\.06\)\]/);
});

test("workspace shell uses a more premium executive frame", () => {
  const workspace = read("components/ai/AiWorkspace.tsx");
  const header = read("components/ai/AiWorkspaceHeader.tsx");

  assert.match(workspace, /bg-\[#f3f6f1\]/);
  assert.match(workspace, /rounded-\[28px\]/);
  assert.match(header, /uppercase tracking-\[0\.24em\]/);
  assert.match(header, /Resumo para decis[ãa]o r[áa]pida/i);
});
