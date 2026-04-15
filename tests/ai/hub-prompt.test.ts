import test from "node:test";
import assert from "node:assert/strict";

import { buildSystemPrompt } from "../../lib/ai/prompts/system.pt-br.ts";

test("Admin AI prompt includes hub label, hub focus, and CEO/strategic framing", () => {
  const prompt = buildSystemPrompt({
    userName: "Paulo",
    userRole: "ADMIN",
    currentDate: "2026-04-14",
    pageContext: "Usuário está em /dashboard/admin/ai",
    toolNames: ["getExecutiveOverview"],
    hub: {
      slug: "admin",
      label: "Admin AI",
      focus: "visão executiva, prioridades do CEO e decisões estratégicas entre áreas",
    },
  });

  assert.match(prompt, /Admin AI/);
  assert.match(prompt, /visão executiva, prioridades do CEO e decisões estratégicas entre áreas/i);
  assert.match(prompt, /CEO|executiv|estrat[ée]g/i);
});

test("prompt enforces concise executive briefing output structure", () => {
  const prompt = buildSystemPrompt({
    userName: "Paulo",
    userRole: "ADMIN",
    currentDate: "2026-04-14",
    pageContext: "Usuário está em /dashboard/admin/ai",
    toolNames: ["getExecutiveOverview"],
    hub: {
      slug: "admin",
      label: "Admin AI",
      focus: "visão executiva, prioridades do CEO e decisões estratégicas entre áreas",
    },
  });

  assert.match(prompt, /sem emojis/i);
  assert.match(prompt, /não use títulos h1/i);
  assert.match(prompt, /Resumo executivo/i);
  assert.match(prompt, /Pontos positivos/i);
  assert.match(prompt, /Pontos de atenção/i);
  assert.match(prompt, /Próxima decisão/i);
});
