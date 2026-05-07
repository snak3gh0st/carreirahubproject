import test from "node:test";
import assert from "node:assert/strict";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const nextConfig = require("../../next.config.js");

test("next config enables standalone output for the Docker runtime", () => {
  assert.equal(nextConfig.output, "standalone");
  assert.deepEqual(nextConfig.typescript, { ignoreBuildErrors: false });
  assert.deepEqual(nextConfig.eslint, { ignoreDuringBuilds: false });
});
