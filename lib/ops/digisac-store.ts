import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  buildDigisacContactUrl,
  findDigisacContactById,
  findDigisacContactByPhone,
  formatDigisacPhone,
  isMatchingDigisacPhone,
  normalizePhone,
} from "@/lib/services/digisac.service";
import type { extractDigisacWebhookMessage } from "@/lib/services/digisac.service";

type DigisacWebhookMessage = NonNullable<ReturnType<typeof extractDigisacWebhookMessage>>;

function isMissingDigisacTable(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  return code === "P2021" || code === "P2022";
}

export function isDigisacStorageMissing(error: unknown) {
  return isMissingDigisacTable(error);
}

async function findCustomerIdByPhone(phoneNumber: string | null) {
  const digits = normalizePhone(phoneNumber);
  if (!digits) return null;
  const suffix = digits.slice(-10);
  const withoutBrazilCode = digits.startsWith("55") ? digits.slice(2) : digits;

  const rows = await prisma.$queryRaw<Array<{ id: string; phone: string | null }>>`
    SELECT id, phone
    FROM customers
    WHERE phone IS NOT NULL
      AND (
        regexp_replace(phone, '[^0-9]', '', 'g') = ${digits}
        OR regexp_replace(phone, '[^0-9]', '', 'g') = ${withoutBrazilCode}
        OR regexp_replace(phone, '[^0-9]', '', 'g') LIKE ${`%${suffix}`}
      )
    LIMIT 10
  `;

  const exact = rows.find((row) => isMatchingDigisacPhone(row.phone, digits));
  return exact?.id ?? null;
}

async function findActiveEnrollmentId(customerId: string | null) {
  if (!customerId) return null;
  const enrollment = await prisma.mentorshipEnrollment.findFirst({
    where: { customerId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  return enrollment?.id ?? null;
}

export async function getOrCreateDigisacThreadForEnrollment(enrollmentId: string) {
  const enrollment = await prisma.mentorshipEnrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
    },
  });
  if (!enrollment) return null;

  const digisacContact = await findDigisacContactByPhone(enrollment.customer.phone).catch((error) => {
    console.warn("[DIGISAC] Failed to resolve contact by phone:", error);
    return null;
  });
  const fallbackPhoneNumber = formatDigisacPhone(enrollment.customer.phone ?? "");
  const phoneNumber = normalizePhone(digisacContact?.phoneNumber) || fallbackPhoneNumber;

  let thread = digisacContact?.id
    ? await prisma.opsDigisacThread.findFirst({
        where: { contactId: digisacContact.id },
        orderBy: { updatedAt: "desc" },
      })
    : null;

  if (!thread) {
    const candidateThreads = await prisma.opsDigisacThread.findMany({
      where: {
        OR: [
          { enrollmentId: enrollment.id },
          { customerId: enrollment.customerId },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    thread = candidateThreads.find((candidate) =>
      isMatchingDigisacPhone(enrollment.customer.phone, candidate.phoneNumber)
    ) ?? null;
  }

  const contactName =
    digisacContact?.internalName ||
    digisacContact?.name ||
    enrollment.customer.name;
  const threadUpdate = {
    customerId: enrollment.customerId,
    enrollmentId: enrollment.id,
    phoneNumber: phoneNumber || thread?.phoneNumber || "",
    contactId: digisacContact?.id ?? thread?.contactId ?? null,
    contactName,
    ticketId: digisacContact?.ticketId ?? thread?.ticketId ?? null,
    serviceId: digisacContact?.serviceId ?? thread?.serviceId ?? null,
    lastSyncedAt: new Date(),
  };

  if (!thread) {
    thread = await prisma.opsDigisacThread.create({
      data: threadUpdate,
    });
  } else {
    thread = await prisma.opsDigisacThread.update({
      where: { id: thread.id },
      data: threadUpdate,
    });
  }

  return thread;
}

export async function getDigisacMessagesForEnrollment(enrollmentId: string) {
  const thread = await getOrCreateDigisacThreadForEnrollment(enrollmentId);
  if (!thread) return null;
  const messages = await prisma.opsDigisacMessage.findMany({
    where: { threadId: thread.id },
    orderBy: [{ externalCreatedAt: "asc" }, { createdAt: "asc" }],
    take: 100,
    include: {
      sentBy: { select: { id: true, name: true, email: true } },
    },
  });

  return {
    thread,
    contactUrl: buildDigisacContactUrl(thread.contactId),
    messages,
  };
}

export async function storeOutboundDigisacMessage(args: {
  enrollmentId: string;
  sentById?: string | null;
  text: string;
  result: {
    externalId: string | null;
    contactId: string | null;
    ticketId: string | null;
    serviceId: string | null;
    status: string | null;
    raw: unknown;
  };
}) {
  const thread = await getOrCreateDigisacThreadForEnrollment(args.enrollmentId);
  if (!thread) throw new Error("Enrollment not found");

  const updatedThread = await prisma.opsDigisacThread.update({
    where: { id: thread.id },
    data: {
      contactId: args.result.contactId ?? thread.contactId,
      ticketId: args.result.ticketId ?? thread.ticketId,
      serviceId: args.result.serviceId ?? thread.serviceId,
      lastMessageAt: new Date(),
      lastSyncedAt: new Date(),
    },
  });

  const data = {
    threadId: updatedThread.id,
    externalId: args.result.externalId,
    direction: "OUTBOUND" as const,
    content: args.text,
    type: "chat",
    status: args.result.status,
    sentById: args.sentById ?? null,
    raw: args.result.raw as Prisma.InputJsonValue,
    externalCreatedAt: new Date(),
  };

  if (args.result.externalId) {
    return prisma.opsDigisacMessage.upsert({
      where: { externalId: args.result.externalId },
      create: data,
      update: { ...data, threadId: updatedThread.id },
    });
  }

  return prisma.opsDigisacMessage.create({ data });
}

export async function storeInboundDigisacWebhookMessage(message: DigisacWebhookMessage) {
  const contact = !message.phoneNumber && message.contactId
    ? await findDigisacContactById(message.contactId).catch((error) => {
        console.warn("[DIGISAC] Failed to resolve webhook contact by id:", error);
        return null;
      })
    : null;
  const phoneNumber = normalizePhone(message.phoneNumber) || normalizePhone(contact?.phoneNumber);
  const customerId = await findCustomerIdByPhone(phoneNumber);
  const enrollmentId = await findActiveEnrollmentId(customerId);

  let thread = await prisma.opsDigisacThread.findFirst({
    where: {
      OR: [
        message.contactId ? { contactId: message.contactId } : undefined,
        phoneNumber ? { phoneNumber } : undefined,
        customerId ? { customerId } : undefined,
      ].filter(Boolean) as any[],
    },
    orderBy: { updatedAt: "desc" },
  });

  const lastMessageAt = message.externalCreatedAt ?? new Date();
  const threadData = {
    phoneNumber,
    contactId: message.contactId,
    contactName: message.contactName ?? contact?.internalName ?? contact?.name,
    ticketId: message.ticketId ?? contact?.ticketId,
    serviceId: message.serviceId ?? contact?.serviceId,
    customerId,
    enrollmentId,
    lastMessageAt,
    lastSyncedAt: new Date(),
    metadata: { source: "digisac_webhook" } as Prisma.InputJsonValue,
  };

  if (!thread) {
    thread = await prisma.opsDigisacThread.create({
      data: threadData,
    });
  } else {
    thread = await prisma.opsDigisacThread.update({
      where: { id: thread.id },
      data: {
        phoneNumber: thread.phoneNumber || phoneNumber,
        contactId: message.contactId ?? thread.contactId,
        contactName: message.contactName ?? thread.contactName,
        ticketId: message.ticketId ?? thread.ticketId,
        serviceId: message.serviceId ?? thread.serviceId,
        customerId: thread.customerId ?? customerId,
        enrollmentId: thread.enrollmentId ?? enrollmentId,
        lastMessageAt,
        lastSyncedAt: new Date(),
      },
    });
  }

  const data = {
    threadId: thread.id,
    externalId: message.externalId,
    direction: message.direction,
    content: message.content,
    type: message.type,
    status: message.status,
    senderName: message.contactName,
    externalCreatedAt: message.externalCreatedAt,
    raw: message.raw as Prisma.InputJsonValue,
  };

  if (message.externalId) {
    return prisma.opsDigisacMessage.upsert({
      where: { externalId: message.externalId },
      create: data,
      update: data,
    });
  }

  return prisma.opsDigisacMessage.create({ data });
}
