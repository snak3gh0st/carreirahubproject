import { prisma } from "@/lib/db";
import {
  buildDigisacLifecycleDedupeKey,
  sendDigisacLifecycleMessageSafely,
} from "@/lib/ops/digisac-lifecycle";
import { isMissingOpsNativeTable } from "@/lib/ops/native-schema";
import { provisionHubAccessForEnrollment } from "@/lib/ops/hub-access-provisioning";
import { getSessionItemKey } from "@/lib/ops/phase-checklists";
import { calculateMentorshipRenewalDate } from "@/lib/ops/renewal";

/**
 * MentorshipError — business rule violations that API routes can distinguish
 * from unexpected errors (e.g. return 409 for DUPLICATE_ENROLLMENT).
 */
export class MentorshipError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "MentorshipError";
  }
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateEnrollmentInput {
  customerId: string;
  programType: "PASS" | "ADVANCED" | "EARLY_CAREER";
  assignedToId: string;
  startDate: Date;
  triggeredById: string; // the User performing the enrollment
}

export interface LogSessionInput {
  enrollmentId: string;
  sessionType: string;
  conductorId: string;
  performedByUserId?: string | null;
  performedByStaffId?: string | null;
  sessionDate: Date;
  status?: string;
  rescheduleCount?: number;
  notes?: string;
}

export interface AdvancePhaseInput {
  enrollmentId: string;
  toPhaseId: string;
  triggeredById: string;
  triggeredByRole: string; // "ADMIN" | "OPERATIONAL" | ...
  reason?: string | null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * MentorshipService
 *
 * Centralises all mentorship write operations so API routes are thin and
 * business rules (duplicate enrollment, forward-only transitions, atomicity)
 * live in one place.
 *
 * Pattern: stateless singleton (same as InvoiceWorkflowService).
 */
export class MentorshipService {
  /**
   * createEnrollment — per D-07 and D-08
   *
   * Atomically creates a MentorshipEnrollment + initial PhaseTransition to
   * the "bastao" phase inside a single Prisma interactive transaction.
   *
   * Throws MentorshipError(DUPLICATE_ENROLLMENT) when an ACTIVE enrollment
   * already exists for the customer — API route converts this to HTTP 409.
   */
  async createEnrollment(data: CreateEnrollmentInput) {
    const { customerId, programType, assignedToId, startDate, triggeredById } = data;

    // 1. Guard: reject duplicate active enrollment
    const existing = await prisma.mentorshipEnrollment.findFirst({
      where: { customerId, status: "ACTIVE" },
    });

    if (existing) {
      throw new MentorshipError(
        `This student is already enrolled in an active ${existing.programType} program.`,
        "DUPLICATE_ENROLLMENT"
      );
    }

    // 2. Resolve the initial phase (bastao is always the entry point)
    const bastaoPhase = await prisma.mentorshipPhase.findUniqueOrThrow({
      where: { key: "bastao" },
    });
    const intakeTemplateId =
      programType === "PASS" || programType === "ADVANCED"
        ? "onboarding-pass"
        : "onboarding-career";

    // 3. Atomic: create enrollment + initial PhaseTransition in one transaction
    const result = await prisma.$transaction(async (tx) => {
      const enrollment = await tx.mentorshipEnrollment.create({
        data: {
          programType,
          status: "ACTIVE",
          startDate,
          customerId,
          assignedToId,
          currentPhaseId: bastaoPhase.id,
        },
      });

      const transition = await tx.phaseTransition.create({
        data: {
          enrollmentId: enrollment.id,
          fromPhaseId: null,
          toPhaseId: bastaoPhase.id,
          triggeredById,
        },
      });

      const existingIntake = await tx.formAssignment.findFirst({
        where: {
          customerId,
          templateId: intakeTemplateId,
          status: { not: "COMPLETED" },
        },
      });

      if (!existingIntake) {
        await tx.formAssignment.create({
          data: {
            templateId: intakeTemplateId,
            customerId,
            assignedById: triggeredById,
          },
        });
      }

      return { enrollment, transition };
    });

    await prisma.opsStudentProfile.create({
      data: {
        enrollmentId: result.enrollment.id,
        customerId,
        renewalDate: calculateMentorshipRenewalDate(startDate),
      },
    }).catch((error) => {
      if (!isMissingOpsNativeTable(error)) {
        console.warn("[MentorshipService] Could not create ops profile:", error);
      }
    });

    await sendDigisacLifecycleMessageSafely({
      event: "program_welcome",
      enrollmentId: result.enrollment.id,
      dedupeKey: buildDigisacLifecycleDedupeKey("program_welcome", result.enrollment.id),
      metadata: {
        source: "mentorship.createEnrollment",
        programType,
        startDate: startDate.toISOString(),
      },
    });

    await provisionHubAccessForEnrollment({
      enrollmentId: result.enrollment.id,
    }).catch((error) => {
      console.warn("[MentorshipService] Could not provision Hub access:", error);
    });

    return result;
  }

  /**
   * logSession — per D-12 and D-13
   *
   * Persists a MentorshipSession row for an ACTIVE enrollment.
   *
   * Throws a plain Error("Enrollment not found or not active") when the
   * enrollment is missing or not ACTIVE.
   */
  async logSession(data: LogSessionInput) {
    const {
      enrollmentId,
      sessionType,
      conductorId,
      performedByUserId,
      performedByStaffId,
      sessionDate,
      notes,
      status,
      rescheduleCount,
    } = data;

    // Guard: enrollment must exist and be ACTIVE (read-only, outside transaction)
    const enrollment = await prisma.mentorshipEnrollment.findFirstOrThrow({
      where: { id: enrollmentId, status: "ACTIVE" },
      include: { currentPhase: true },
    }).catch(() => {
      throw new Error("Enrollment not found or not active");
    });

    // Session write + checklist auto-mark in a single atomic transaction.
    const session = await prisma.$transaction(async (tx) => {
      const created = await tx.mentorshipSession.create({
        data: {
          enrollmentId,
          sessionType,
          conductorId,
          performedByUserId: performedByUserId ?? null,
          performedByStaffId: performedByStaffId ?? null,
          sessionDate,
          status: status ?? "REALIZADO",
          rescheduleCount: rescheduleCount ?? 0,
          notes,
        },
      });

      const phaseKey = enrollment.currentPhase?.key;
      if (phaseKey) {
        const sessionCount = await tx.mentorshipSession.count({
          where: { enrollmentId },
        });
        const itemKey = getSessionItemKey(phaseKey, sessionCount);
        if (itemKey) {
          await tx.phaseChecklistProgress.upsert({
            where: { enrollmentId_phaseKey_itemKey: { enrollmentId, phaseKey, itemKey } },
            create: { enrollmentId, phaseKey, itemKey, completedAt: new Date(), completedById: conductorId },
            update: { completedAt: new Date(), completedById: conductorId },
          });
        }
      }

      return created;
    });

    return session;
  }

  /**
   * advancePhase — per D-09, D-10, D-11
   *
   * Atomically writes a PhaseTransition + updates MentorshipEnrollment.currentPhaseId.
   *
   * For non-ADMIN roles enforces forward-only (sequential) transitions:
   * toPhase.sortOrder must equal currentPhase.sortOrder + 1.
   * Throws MentorshipError(INVALID_TRANSITION) when the constraint is violated.
   */
  async advancePhase(data: AdvancePhaseInput) {
    const { enrollmentId, toPhaseId, triggeredById, triggeredByRole, reason } = data;

    // 1. Fetch the active enrollment including its current phase
    const enrollment = await prisma.mentorshipEnrollment.findFirstOrThrow({
      where: { id: enrollmentId, status: "ACTIVE" },
      include: { currentPhase: true },
    });

    // 2. Fetch the target phase
    const toPhase = await prisma.mentorshipPhase.findUniqueOrThrow({
      where: { id: toPhaseId },
    });

    // 3. Forward-only enforcement for non-ADMIN roles (per D-09)
    if (triggeredByRole !== "ADMIN") {
      const currentSortOrder = enrollment.currentPhase?.sortOrder ?? -1;
      const expectedSortOrder = currentSortOrder + 1;

      if (toPhase.sortOrder !== expectedSortOrder) {
        throw new MentorshipError(
          `Phase transitions must be sequential. Expected sortOrder ${expectedSortOrder}, got ${toPhase.sortOrder}.`,
          "INVALID_TRANSITION"
        );
      }
    }

    // 4. Atomic: write PhaseTransition + update enrollment in one transaction
    const result = await prisma.$transaction(async (tx) => {
      const transition = await tx.phaseTransition.create({
        data: {
          enrollmentId,
          fromPhaseId: enrollment.currentPhaseId,
          toPhaseId,
          reason,
          triggeredById,
        },
      });

      const updatedEnrollment = await tx.mentorshipEnrollment.update({
        where: { id: enrollmentId },
        data: { currentPhaseId: toPhaseId },
      });

      return { transition, enrollment: updatedEnrollment };
    });

    if (toPhase.key === "marcar_teste_ingles" || toPhase.key === "teste_de_ingles") {
      await sendDigisacLifecycleMessageSafely({
        event: "english_test_ready",
        enrollmentId,
        dedupeKey: buildDigisacLifecycleDedupeKey(
          "english_test_ready",
          `${result.transition.id}:${toPhase.key}`
        ),
        title: toPhase.label,
        metadata: {
          source: "mentorship.advancePhase",
          phaseKey: toPhase.key,
          transitionId: result.transition.id,
        },
      });
    }

    return result;
  }
}

export const mentorshipService = new MentorshipService();
