import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAccessAuditMetadata,
  isAuditablePath,
  sanitizeAuditPath,
} from "../lib/admin/access-audit";

describe("admin access audit helpers", () => {
  it("redacts sensitive query params before storing paths", () => {
    assert.equal(
      sanitizeAuditPath(
        "/dashboard/quickbooks?code=abc123&state=oauth-state&from=admin&token=secret"
      ),
      "/dashboard/quickbooks?from=admin"
    );
  });

  it("only tracks app surfaces that matter for admin audit", () => {
    assert.equal(isAuditablePath("/dashboard/admin"), true);
    assert.equal(isAuditablePath("/api/dashboard/metrics"), true);
    assert.equal(isAuditablePath("/ops/enrollments"), true);
    assert.equal(isAuditablePath("/hub/forms"), true);

    assert.equal(isAuditablePath("/api/cron/process-queue"), false);
    assert.equal(isAuditablePath("/api/webhooks/quickbooks"), false);
    assert.equal(isAuditablePath("/api/internal/access-audit"), false);
    assert.equal(isAuditablePath("/_next/static/app.js"), false);
  });

  it("builds actor and request metadata without leaking secrets", () => {
    const metadata = buildAccessAuditMetadata({
      action: "ENDPOINT_ACCESS",
      actorType: "internal",
      email: "admin@example.com",
      role: "ADMIN",
      method: "GET",
      path: "/dashboard/admin?secret=hidden&section=logs",
      statusCode: 200,
      ip: "203.0.113.10",
      userAgent: "Mozilla/5.0",
      host: "app.carreirausa.com",
      source: "middleware",
    });

    assert.equal(metadata.actorType, "internal");
    assert.equal(metadata.email, "admin@example.com");
    assert.equal(metadata.path, "/dashboard/admin?section=logs");
    assert.equal(metadata.method, "GET");
    assert.equal(metadata.statusCode, 200);
    assert.equal(metadata.ip, "203.0.113.10");
    assert.equal(metadata.host, "app.carreirausa.com");
    assert.equal(metadata.source, "middleware");
    assert.equal(Object.hasOwn(metadata, "secret"), false);
  });
});
