CREATE TABLE "ops_student_profiles" (
  "id" TEXT NOT NULL,
  "optStatus" TEXT,
  "coachCohort" TEXT,
  "classAttendancePercent" INTEGER,
  "boardUrl" TEXT,
  "notionUrl" TEXT,
  "linkedinUrl" TEXT,
  "interviewRecordingFolderUrl" TEXT,
  "contractPdfKey" TEXT,
  "renewalDate" TIMESTAMP(3),
  "renewalState" TEXT NOT NULL DEFAULT 'NOT_DUE',
  "renewalReminder30SentAt" TIMESTAMP(3),
  "renewalReminder15SentAt" TIMESTAMP(3),
  "renewalReminder7SentAt" TIMESTAMP(3),
  "lastOperationalContactAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,

  CONSTRAINT "ops_student_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ops_student_documents" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'UPLOADED',
  "title" TEXT,
  "filename" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "extractedText" TEXT,
  "notes" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "finalizedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "uploadedById" TEXT,
  "reviewedById" TEXT,

  CONSTRAINT "ops_student_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ops_student_activities" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "activityDate" TIMESTAMP(3) NOT NULL,
  "company" TEXT,
  "roleTitle" TEXT,
  "area" TEXT,
  "industry" TEXT,
  "source" TEXT,
  "outcome" TEXT,
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "createdById" TEXT,

  CONSTRAINT "ops_student_activities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ops_student_profiles_enrollmentId_key" ON "ops_student_profiles"("enrollmentId");
CREATE INDEX "ops_student_profiles_customerId_idx" ON "ops_student_profiles"("customerId");
CREATE INDEX "ops_student_profiles_renewalDate_idx" ON "ops_student_profiles"("renewalDate");
CREATE INDEX "ops_student_profiles_renewalState_idx" ON "ops_student_profiles"("renewalState");
CREATE INDEX "ops_student_documents_enrollmentId_kind_idx" ON "ops_student_documents"("enrollmentId", "kind");
CREATE INDEX "ops_student_documents_customerId_uploadedAt_idx" ON "ops_student_documents"("customerId", "uploadedAt");
CREATE INDEX "ops_student_documents_status_idx" ON "ops_student_documents"("status");
CREATE INDEX "ops_student_activities_enrollmentId_activityDate_idx" ON "ops_student_activities"("enrollmentId", "activityDate");
CREATE INDEX "ops_student_activities_type_activityDate_idx" ON "ops_student_activities"("type", "activityDate");

ALTER TABLE "ops_student_profiles"
  ADD CONSTRAINT "ops_student_profiles_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "mentorship_enrollments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_student_profiles"
  ADD CONSTRAINT "ops_student_profiles_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ops_student_documents"
  ADD CONSTRAINT "ops_student_documents_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "mentorship_enrollments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_student_documents"
  ADD CONSTRAINT "ops_student_documents_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ops_student_documents"
  ADD CONSTRAINT "ops_student_documents_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ops_student_documents"
  ADD CONSTRAINT "ops_student_documents_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ops_student_activities"
  ADD CONSTRAINT "ops_student_activities_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "mentorship_enrollments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_student_activities"
  ADD CONSTRAINT "ops_student_activities_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "mentorship_phases" SET "sortOrder" = "sortOrder" + 1000;

INSERT INTO "mentorship_phases" ("id", "key", "label", "sortOrder", "slaDays", "createdAt", "updatedAt") VALUES
  ('phase_bastao', 'bastao', 'Passagem de Bastão', 1, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_cadastro', 'cadastro', 'Cadastro e Acessos', 2, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_marcar_teste_ingles', 'marcar_teste_ingles', 'Marcar Teste de Inglês', 3, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_teste_de_ingles', 'teste_de_ingles', 'Teste de Inglês', 4, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_passou_teste_ingles', 'passou_teste_ingles', 'Passou no Teste de Inglês', 5, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_nao_passou_teste_ingles', 'nao_passou_teste_ingles', 'Não passou no Teste de Inglês', 6, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_marcar_onboarding', 'marcar_onboarding', 'Marcar Onboarding', 7, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_onboarding_marcado', 'onboarding_marcado', 'Onboarding Marcado', 8, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_onboarding', 'onboarding', 'Onboarding Realizado', 9, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_preparacao_board', 'preparacao_board', 'Preparação do Board', 10, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_board', 'board', 'Board', 11, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_pode_marcar_bussola', 'pode_marcar_bussola', 'Pode Marcar a Bússola', 12, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_bussola_marcada', 'bussola_marcada', 'Sessão Bússola Marcada', 13, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_bussola', 'bussola', 'Sessão Bússola Realizada', 14, 14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_finalizar_board', 'finalizar_board', 'Finalizar o Board', 15, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_marcar_raio_x', 'marcar_raio_x', 'Marcar Sessão Raio-X', 16, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_raio_x', 'raio_x', 'Sessão Raio-X Realizada', 17, 14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_construcao_material', 'construcao_material', 'Construção de Material', 18, 21, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_material', 'material', 'Material', 19, 21, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_em_revisao', 'em_revisao', 'Em Processo de Revisão', 20, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_realizar_devolutiva', 'realizar_devolutiva', 'Realizar Devolutiva', 21, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_devolutiva', 'devolutiva', 'Devolutiva Feita', 22, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_suporte_15_min', 'suporte_15_min', '15 Minutos com o Suporte', 23, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_suporte_marcado', 'suporte_marcado', 'Marcado com o Suporte', 24, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_marcar_treinamento_entrevista', 'marcar_treinamento_entrevista', 'Marcar Treinamento de Entrevista', 25, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_treinamento_entrevista', 'treinamento_entrevista', 'Treinamento de Entrevista', 26, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_treinamento_entrevista_marcado', 'treinamento_entrevista_marcado', 'Treinamento de Entrevista Marcado', 27, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_mock_interview_1', 'mock_interview_1', '1ª Mock Interview', 28, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_mock_interview_2', 'mock_interview_2', '2ª Mock Interview', 29, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_ongoing', 'ongoing', 'Ongoing / Aplicações', 30, 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_aguardando_recolocacao', 'aguardando_recolocacao', 'Aguardando Recolocação', 31, 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_precisa_renovar', 'precisa_renovar', 'Precisa Renovar', 32, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_audio_renovacao_enviado', 'audio_renovacao_enviado', 'Áudio de Renovação Enviado', 33, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_renovacao', 'renovacao', 'Renovação', 34, 14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('phase_mentoria_encerrada', 'mentoria_encerrada', 'Mentoria Encerrada', 35, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET
  "label" = EXCLUDED."label",
  "sortOrder" = EXCLUDED."sortOrder",
  "slaDays" = EXCLUDED."slaDays",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "ops_student_profiles" (
  "id",
  "enrollmentId",
  "customerId",
  "renewalDate",
  "renewalState",
  "createdAt",
  "updatedAt"
)
SELECT
  'ops_profile_' || "id",
  "id",
  "customerId",
  "endDate",
  CASE
    WHEN "endDate" IS NOT NULL AND "endDate" <= CURRENT_TIMESTAMP + INTERVAL '30 days' THEN 'DUE_SOON'
    ELSE 'NOT_DUE'
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "mentorship_enrollments"
ON CONFLICT ("enrollmentId") DO NOTHING;
