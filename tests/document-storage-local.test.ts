import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { DocumentStorageService } from "@/lib/services/document-storage.service";

async function withLocalStorageEnv<T>(fn: (root: string) => Promise<T>) {
  const previous = {
    STORAGE_DRIVER: process.env.STORAGE_DRIVER,
    LOCAL_STORAGE_ROOT: process.env.LOCAL_STORAGE_ROOT,
    AWS_REGION: process.env.AWS_REGION,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  };
  const root = await mkdtemp(path.join(tmpdir(), "carreirahub-storage-"));

  process.env.STORAGE_DRIVER = "local";
  process.env.LOCAL_STORAGE_ROOT = root;
  delete process.env.AWS_REGION;
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  delete process.env.S3_BUCKET_NAME;
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXTAUTH_URL;

  try {
    return await fn(root);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    await rm(root, { recursive: true, force: true });
  }
}

test("local storage writes signed contracts under the configured root", async () => {
  await withLocalStorageEnv(async () => {
    const service = new DocumentStorageService();
    const pdf = Buffer.from("%PDF-1.4 test contract");

    assert.equal(service.isConfigured(), true);

    const key = await service.uploadSignedContract("envelope-123", pdf, {
      contractId: "contract-123",
      customerId: "customer-123",
    });
    const stored = await service.downloadDocument(key);
    const downloadUrl = await service.getPresignedUrl(key);

    assert.match(key, /^contracts\/\d{4}\/envelope-123\.pdf$/);
    assert.deepEqual(stored, pdf);
    assert.equal(downloadUrl, `/api/storage/local?key=${encodeURIComponent(key)}`);
  });
});

test("local storage rejects path traversal keys", async () => {
  await withLocalStorageEnv(async () => {
    const service = new DocumentStorageService();

    await assert.rejects(
      () => service.downloadDocument("../secret.txt"),
      /Invalid storage key/
    );
  });
});

test("local storage writes arbitrary document keys for hub uploads", async () => {
  await withLocalStorageEnv(async () => {
    const service = new DocumentStorageService();
    const file = Buffer.from("uploaded file");
    const key = "forms/customer-123/assignment-123/passport/upload.pdf";

    await service.uploadObject(key, file, {
      contentType: "application/pdf",
      metadata: { fieldId: "passport" },
    });

    assert.deepEqual(await service.downloadDocument(key), file);
  });
});
