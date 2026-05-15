import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSyncableClintContacts,
  buildClintDealWriteData,
  extractClintOwnerEmail,
} from "../lib/services/clint-sync.service";
import { isUniqueConstraintError } from "../lib/services/identity-mapper";

test("buildSyncableClintContacts dedupes by Clint id and email", () => {
  const contacts = buildSyncableClintContacts([
    { id: " contact-1 ", name: "First", email: " First@Example.com " },
    { id: "contact-1", name: "Duplicate id", email: "other@example.com" },
    { id: "contact-2", name: "Duplicate email", email: "first@example.com" },
    { id: "contact-3", name: "Missing email" },
    { id: "", name: "Missing id", email: "missing-id@example.com" },
    { id: "contact-4", name: "Second", email: "second@example.com" },
  ]);

  assert.deepEqual(
    contacts.map((contact) => ({ id: contact.id, email: contact.email })),
    [
      { id: "contact-1", email: "first@example.com" },
      { id: "contact-4", email: "second@example.com" },
    ],
  );
});

test("buildClintDealWriteData preserves Clint owner and external timestamps", () => {
  const syncTimestamp = new Date("2026-05-05T16:00:00.000Z");
  const data = buildClintDealWriteData(
    {
      id: "deal-1",
      name: "PASS - Cliente",
      value: "2500" as any,
      status: "WON",
      created_at: "2026-03-30T18:54:34.649755+00:00",
      updated_at: "2026-04-16T03:24:10.956023+00:00",
      user: {
        email: "Jessica.Reis@CarreiraUSA.com",
        full_name: "Jessica Barreto",
      },
    },
    {
      customerId: "customer-1",
      userIdByEmail: new Map([["jessica.reis@carreirausa.com", "seller-1"]]),
      syncTimestamp,
    },
  );

  assert.equal(data.title, "PASS - Cliente");
  assert.equal(Number(data.value), 2500);
  assert.equal(data.status, "WON");
  assert.equal(data.customerId, "customer-1");
  assert.equal(data.ownerId, "seller-1");
  assert.equal(data.createdAt?.toISOString(), "2026-03-30T18:54:34.649Z");
  assert.equal(data.updatedAt?.toISOString(), "2026-04-16T03:24:10.956Z");
  assert.equal(data.lastClintSyncAt.toISOString(), syncTimestamp.toISOString());
});

test("extractClintOwnerEmail normalizes owner email from Clint deal user payload", () => {
  assert.equal(
    extractClintOwnerEmail({ user: { email: " Comercial@CarreiraUSA.com " } } as any),
    "comercial@carreirausa.com",
  );
});

test("isUniqueConstraintError detects wrapped Prisma unique errors", () => {
  assert.equal(isUniqueConstraintError({ code: "P2002" }), true);
  assert.equal(
    isUniqueConstraintError(
      new Error("Invalid `prisma.customer.create()` invocation:\n\nUnique constraint failed on the fields: (`clint_contact_id`)")
    ),
    true,
  );
});
