import assert from "node:assert/strict";
import test from "node:test";

import { isAllowedCsrfOrigin } from "../../lib/hub-auth";

test("isAllowedCsrfOrigin allows alternate loopback ports outside production", () => {
  assert.equal(
    isAllowedCsrfOrigin(
      "http://localhost:3001",
      "http://localhost:3000",
      "development"
    ),
    true
  );
});

test("isAllowedCsrfOrigin stays strict for mismatched production origins", () => {
  assert.equal(
    isAllowedCsrfOrigin(
      "http://localhost:3001",
      "http://localhost:3000",
      "production"
    ),
    false
  );
});

test("isAllowedCsrfOrigin rejects non-loopback origins outside production", () => {
  assert.equal(
    isAllowedCsrfOrigin(
      "https://evil.example",
      "http://localhost:3000",
      "development"
    ),
    false
  );
});
