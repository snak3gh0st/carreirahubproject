import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

test("AI chat submissions are single-flight while the SDK stream is active", () => {
  const panel = read("components/ai/ChatPanel.tsx");
  const composer = read("components/ai/Composer.tsx");
  const opsPanel = read("app/ops/students/[enrollmentId]/OpsStudentAiPanel.tsx");
  const pipeline = read("app/ops/pipeline/PipelineBoard.tsx");

  assert.match(panel, /sendInFlightRef/);
  assert.match(panel, /await \(sendMessage as any\)/);
  assert.match(panel, /disabled=\{isBusy\}/);
  assert.match(composer, /sendingRef/);
  assert.match(opsPanel, /sendInFlightRef/);
  assert.match(pipeline, /summaryInFlightRef/);
});
