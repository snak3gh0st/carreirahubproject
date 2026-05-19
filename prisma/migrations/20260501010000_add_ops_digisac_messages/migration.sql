CREATE TYPE "OpsDigisacMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'SYSTEM');

CREATE TABLE "ops_digisac_threads" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "contactId" TEXT,
    "contactName" TEXT,
    "ticketId" TEXT,
    "serviceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "lastMessageAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT,
    "enrollmentId" TEXT,

    CONSTRAINT "ops_digisac_threads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ops_digisac_messages" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "direction" "OpsDigisacMessageDirection" NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT,
    "status" TEXT,
    "senderName" TEXT,
    "externalCreatedAt" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "threadId" TEXT NOT NULL,
    "sentById" TEXT,

    CONSTRAINT "ops_digisac_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ops_digisac_threads_customerId_updatedAt_idx" ON "ops_digisac_threads"("customerId", "updatedAt");
CREATE INDEX "ops_digisac_threads_enrollmentId_updatedAt_idx" ON "ops_digisac_threads"("enrollmentId", "updatedAt");
CREATE INDEX "ops_digisac_threads_contactId_idx" ON "ops_digisac_threads"("contactId");
CREATE INDEX "ops_digisac_threads_phoneNumber_idx" ON "ops_digisac_threads"("phoneNumber");

CREATE UNIQUE INDEX "ops_digisac_messages_externalId_key" ON "ops_digisac_messages"("externalId");
CREATE INDEX "ops_digisac_messages_threadId_createdAt_idx" ON "ops_digisac_messages"("threadId", "createdAt");
CREATE INDEX "ops_digisac_messages_direction_createdAt_idx" ON "ops_digisac_messages"("direction", "createdAt");
CREATE INDEX "ops_digisac_messages_sentById_idx" ON "ops_digisac_messages"("sentById");

ALTER TABLE "ops_digisac_threads" ADD CONSTRAINT "ops_digisac_threads_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ops_digisac_threads" ADD CONSTRAINT "ops_digisac_threads_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "mentorship_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ops_digisac_messages" ADD CONSTRAINT "ops_digisac_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ops_digisac_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ops_digisac_messages" ADD CONSTRAINT "ops_digisac_messages_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TYPE "OpsDigisacMessageDirection" OWNER TO carreirausa;
ALTER TABLE "ops_digisac_threads" OWNER TO carreirausa;
ALTER TABLE "ops_digisac_messages" OWNER TO carreirausa;
GRANT USAGE ON TYPE "OpsDigisacMessageDirection" TO carreirausa;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE "ops_digisac_threads" TO carreirausa;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE "ops_digisac_messages" TO carreirausa;
