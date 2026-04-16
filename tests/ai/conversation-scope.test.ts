import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("AiConversation schema persists the hub discriminator", () => {
  const schema = fs.readFileSync("prisma/schema.prisma", "utf8");

  assert.match(schema, /enum AiHub/);
  assert.match(schema, /hub\s+AiHub/);
  assert.match(schema, /@@index\(\[userId, hub, updatedAt\]\)/);
});

test("conversation collection route reads hub from query string and scopes list/delete by user + hub", () => {
  const route = fs.readFileSync("app/api/dashboard/ai/conversations/route.ts", "utf8");

  assert.match(route, /searchParams\.get\(['"]hub['"]\)/);
  assert.match(route, /findMany\(\{\s*where:\s*\{\s*userId,\s*hub:/s);
  assert.match(route, /deleteMany\(\{\s*where:\s*\{\s*id,\s*userId,\s*hub:/s);
});

test("conversation detail route enforces hub-aware fetch behavior", () => {
  const route = fs.readFileSync("app/api/dashboard/ai/conversations/[id]/route.ts", "utf8");

  assert.match(route, /searchParams\.get\(['"]hub['"]\)/);
  assert.match(route, /findFirst\(\{\s*where:\s*\{\s*id:\s*params\.id,\s*userId,\s*hub:/s);
});

test("chat route validates hub, scopes conversation persistence, and passes hub metadata into the prompt", () => {
  const route = fs.readFileSync("app/api/dashboard/ai/chat/route.ts", "utf8");

  assert.match(route, /getAiHubBySlug/);
  assert.match(route, /isRoleAllowedForHub/);
  assert.match(route, /const\s+hubSlug\s*=\s*body\.hub/);
  assert.match(route, /findFirst\(\{\s*where:\s*\{\s*id:\s*bodyConvId,\s*userId:\s*user\.id,\s*hub:/s);
  assert.match(route, /create\(\{\s*data:\s*\{\s*userId:\s*user\.id,\s*title:\s*userText\.slice\(0,\s*80\),\s*hub:/s);
  assert.match(route, /buildSystemPrompt\(\{\s*[\s\S]*hub:/s);
  assert.match(route, /Conversa não encontrada para este hub/);
});
