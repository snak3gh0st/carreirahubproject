import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

export interface DeleteInternalUserInput {
  targetUserId: string;
  replacementUserId: string;
}

export interface DeleteInternalUserResult {
  deletedUserId: string;
  replacementUserId: string;
  targetEmail: string;
  replacementEmail: string;
  summary: {
    nullified: Record<string, number>;
    reassigned: Record<string, number>;
    deleted: Record<string, number>;
  };
}

export async function deleteInternalUser(
  input: DeleteInternalUserInput
): Promise<DeleteInternalUserResult> {
  return prisma.$transaction((tx) => deleteInternalUserTx(tx, input), {
    maxWait: 5_000,
    timeout: 20_000,
  });
}

export async function deleteInternalUserTx(
  tx: Prisma.TransactionClient,
  input: DeleteInternalUserInput
): Promise<DeleteInternalUserResult> {
  const { targetUserId, replacementUserId } = input;

  if (!targetUserId || !replacementUserId) {
    throw new Error("targetUserId and replacementUserId are required");
  }

  if (targetUserId === replacementUserId) {
    throw new Error("Cannot reassign references to the same user being deleted");
  }

  const [targetUser, replacementUser, ownedSupportTickets] = await Promise.all([
    tx.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true },
    }),
    tx.user.findUnique({
      where: { id: replacementUserId },
      select: { id: true, email: true, active: true },
    }),
    tx.supportTicket.findMany({
      where: { userId: targetUserId },
      select: { id: true },
    }),
  ]);

  if (!targetUser) {
    throw new Error("User not found");
  }

  if (!replacementUser || !replacementUser.active) {
    throw new Error("Replacement user not found or inactive");
  }

  const ownedSupportTicketIds = ownedSupportTickets.map((ticket) => ticket.id);

  const nullified = {
    bulkImports: (
      await tx.bulkImport.updateMany({
        where: { startedBy: targetUserId },
        data: { startedBy: null },
      })
    ).count,
    escalatedConversations: (
      await tx.conversation.updateMany({
        where: { escalatedToId: targetUserId },
        data: { escalatedToId: null },
      })
    ).count,
    createdCustomers: (
      await tx.customer.updateMany({
        where: { createdById: targetUserId },
        data: { createdById: null },
      })
    ).count,
    ownedDeals: (
      await tx.deal.updateMany({
        where: { ownerId: targetUserId },
        data: { ownerId: null },
      })
    ).count,
    ownedInvoices: (
      await tx.invoice.updateMany({
        where: { ownerId: targetUserId },
        data: { ownerId: null },
      })
    ).count,
    leadQualifications: (
      await tx.leadQualification.updateMany({
        where: { qualifiedById: targetUserId },
        data: { qualifiedById: null },
      })
    ).count,
    createdLeads: (
      await tx.lead.updateMany({
        where: { createdById: targetUserId },
        data: { createdById: null },
      })
    ).count,
    qualifiedLeads: (
      await tx.lead.updateMany({
        where: { qualifiedById: targetUserId },
        data: { qualifiedById: null },
      })
    ).count,
    assignedSupportTickets: (
      await tx.supportTicket.updateMany({
        where: { assignedToId: targetUserId },
        data: { assignedToId: null },
      })
    ).count,
    uploadedOpsDocuments: (
      await tx.opsStudentDocument.updateMany({
        where: { uploadedById: targetUserId },
        data: { uploadedById: null },
      })
    ).count,
    reviewedOpsDocuments: (
      await tx.opsStudentDocument.updateMany({
        where: { reviewedById: targetUserId },
        data: { reviewedById: null },
      })
    ).count,
    createdOpsActivities: (
      await tx.opsStudentActivity.updateMany({
        where: { createdById: targetUserId },
        data: { createdById: null },
      })
    ).count,
    opsComments: (
      await tx.opsStudentComment.updateMany({
        where: { authorId: targetUserId },
        data: { authorId: null },
      })
    ).count,
    digisacMessages: (
      await tx.opsDigisacMessage.updateMany({
        where: { sentById: targetUserId },
        data: { sentById: null },
      })
    ).count,
    checklistProgress: (
      await tx.phaseChecklistProgress.updateMany({
        where: { completedById: targetUserId },
        data: { completedById: null },
      })
    ).count,
  };

  const reassigned = {
    formAssignments: (
      await tx.formAssignment.updateMany({
        where: { assignedById: targetUserId },
        data: { assignedById: replacementUserId },
      })
    ).count,
    mentorshipEnrollments: (
      await tx.mentorshipEnrollment.updateMany({
        where: { assignedToId: targetUserId },
        data: { assignedToId: replacementUserId },
      })
    ).count,
    mentorshipSessions: (
      await tx.mentorshipSession.updateMany({
        where: { conductorId: targetUserId },
        data: { conductorId: replacementUserId },
      })
    ).count,
    phaseTransitions: (
      await tx.phaseTransition.updateMany({
        where: { triggeredById: targetUserId },
        data: { triggeredById: replacementUserId },
      })
    ).count,
  };

  const deleted = {
    aiRateLimit: (
      await tx.aiRateLimit.deleteMany({
        where: { userId: targetUserId },
      })
    ).count,
    aiConversations: (
      await tx.aiConversation.deleteMany({
        where: { userId: targetUserId },
      })
    ).count,
    supportMessages: ownedSupportTicketIds.length
      ? (
          await tx.supportMessage.deleteMany({
            where: { ticketId: { in: ownedSupportTicketIds } },
          })
        ).count
      : 0,
    supportTickets: ownedSupportTicketIds.length
      ? (
          await tx.supportTicket.deleteMany({
            where: { id: { in: ownedSupportTicketIds } },
          })
        ).count
      : 0,
  };

  await tx.user.delete({
    where: { id: targetUserId },
  });

  return {
    deletedUserId: targetUser.id,
    replacementUserId: replacementUser.id,
    targetEmail: targetUser.email,
    replacementEmail: replacementUser.email,
    summary: {
      nullified,
      reassigned,
      deleted,
    },
  };
}
