import assert from "node:assert/strict";
import test from "node:test";

import { deleteInternalUserTx } from "../lib/team/delete-internal-user";

function createCountRecorder(
  calls: Array<{ table: string; method: string; args: unknown }>
) {
  return (table: string, method: string, count = 1) => async (args: unknown) => {
    calls.push({ table, method, args });
    return { count };
  };
}

function createTransactionDouble(options?: {
  targetUser?: { id: string; email: string } | null;
  replacementUser?: { id: string; email: string; active: boolean } | null;
  supportTicketIds?: string[];
}) {
  const calls: Array<{ table: string; method: string; args: unknown }> = [];
  const recordCount = createCountRecorder(calls);
  const targetUser = options?.targetUser ?? { id: "target-user", email: "old@carreirausa.com" };
  const replacementUser = options?.replacementUser ?? {
    id: "replacement-user",
    email: "admin@carreirausa.com",
    active: true,
  };
  const supportTicketIds = options?.supportTicketIds ?? ["ticket-1", "ticket-2"];

  const tx = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        calls.push({ table: "user", method: "findUnique", args: { where } });
        if (where.id === targetUser?.id) return targetUser;
        if (where.id === replacementUser?.id) return replacementUser;
        return null;
      },
      delete: async (args: unknown) => {
        calls.push({ table: "user", method: "delete", args });
        return { id: targetUser?.id };
      },
    },
    supportTicket: {
      findMany: async () => {
        calls.push({ table: "supportTicket", method: "findMany", args: null });
        return supportTicketIds.map((id) => ({ id }));
      },
      updateMany: recordCount("supportTicket", "updateMany"),
      deleteMany: recordCount("supportTicket", "deleteMany", supportTicketIds.length),
    },
    supportMessage: {
      deleteMany: recordCount("supportMessage", "deleteMany", supportTicketIds.length),
    },
    bulkImport: { updateMany: recordCount("bulkImport", "updateMany") },
    conversation: { updateMany: recordCount("conversation", "updateMany") },
    customer: { updateMany: recordCount("customer", "updateMany") },
    deal: { updateMany: recordCount("deal", "updateMany") },
    invoice: { updateMany: recordCount("invoice", "updateMany") },
    leadQualification: { updateMany: recordCount("leadQualification", "updateMany") },
    lead: { updateMany: recordCount("lead", "updateMany") },
    opsStudentDocument: { updateMany: recordCount("opsStudentDocument", "updateMany") },
    opsStudentActivity: { updateMany: recordCount("opsStudentActivity", "updateMany") },
    opsStudentComment: { updateMany: recordCount("opsStudentComment", "updateMany") },
    opsDigisacMessage: { updateMany: recordCount("opsDigisacMessage", "updateMany") },
    phaseChecklistProgress: { updateMany: recordCount("phaseChecklistProgress", "updateMany") },
    formAssignment: { updateMany: recordCount("formAssignment", "updateMany") },
    mentorshipEnrollment: { updateMany: recordCount("mentorshipEnrollment", "updateMany") },
    mentorshipSession: { updateMany: recordCount("mentorshipSession", "updateMany") },
    phaseTransition: { updateMany: recordCount("phaseTransition", "updateMany") },
    aiRateLimit: { deleteMany: recordCount("aiRateLimit", "deleteMany") },
    aiConversation: { deleteMany: recordCount("aiConversation", "deleteMany") },
  };

  return { tx, calls };
}

test("deleteInternalUserTx clears dependent records and reassigns required history", async () => {
  const { tx, calls } = createTransactionDouble();

  const result = await deleteInternalUserTx(tx as never, {
    targetUserId: "target-user",
    replacementUserId: "replacement-user",
  });

  assert.equal(result.deletedUserId, "target-user");
  assert.equal(result.replacementUserId, "replacement-user");
  assert.equal(result.summary.deleted.supportMessages, 2);
  assert.equal(result.summary.deleted.supportTickets, 2);
  assert.equal(result.summary.reassigned.formAssignments, 1);

  assert.deepEqual(
    calls.find((call) => call.table === "formAssignment" && call.method === "updateMany")?.args,
    {
      where: { assignedById: "target-user" },
      data: { assignedById: "replacement-user" },
    }
  );
  assert.deepEqual(
    calls.find((call) => call.table === "supportMessage" && call.method === "deleteMany")?.args,
    {
      where: { ticketId: { in: ["ticket-1", "ticket-2"] } },
    }
  );
  assert.deepEqual(
    calls.at(-1),
    {
      table: "user",
      method: "delete",
      args: { where: { id: "target-user" } },
    }
  );
});

test("deleteInternalUserTx rejects invalid replacement users", async () => {
  const { tx } = createTransactionDouble({
    replacementUser: { id: "replacement-user", email: "admin@carreirausa.com", active: false },
  });

  await assert.rejects(
    deleteInternalUserTx(tx as never, {
      targetUserId: "target-user",
      replacementUserId: "replacement-user",
    }),
    /Replacement user not found or inactive/
  );
});
