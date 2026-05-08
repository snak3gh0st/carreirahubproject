import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function importModuleWithoutOpenAi(modulePath: string) {
  const { stdout } = await execFileAsync(
    "npx",
    [
      "tsx",
      "--eval",
      `(async () => { delete process.env.OPENAI_API_KEY; await import(${JSON.stringify(modulePath)}); console.log("ok"); })().catch((error) => { console.error(error); process.exit(1); });`,
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, OPENAI_API_KEY: "" },
    }
  );

  assert.match(stdout, /ok/);
}

test("AI services import safely without OPENAI_API_KEY", async () => {
  await importModuleWithoutOpenAi("./lib/services/ai.service.ts");
  await importModuleWithoutOpenAi("./lib/services/cfo-analysis.ts");
  await importModuleWithoutOpenAi("./lib/services/collection-call.service.ts");
});
