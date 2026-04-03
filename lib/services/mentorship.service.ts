import { prisma } from "@/lib/db";

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
  programType: "PASS" | "ADVANCED";
  assignedToId: string;
  startDate: Date;
  triggeredById: string; // the User performing the enrollment
}

export interface LogSessionInput {
  enrollmentId: string;
  sessionType: string;
  conductorId: string;
  sessionDate: Date;
  notes?: string;
}

export interface AdvancePhaseInput {
  enrollmentId: string;
  toPhaseId: string;
  triggeredById: string;
  triggeredByRole: string; // "ADMIN" | "OPERATIONAL" | ...
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
      programType === "PASS" ? "onboarding-pass" : "onboarding-career";

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
    const { enrollmentId, sessionType, conductorId, sessionDate, notes } = data;

    // 1. Guard: enrollment must exist and be ACTIVE
    try {
      await prisma.mentorshipEnrollment.findFirstOrThrow({
        where: { id: enrollmentId, status: "ACTIVE" },
      });
    } catch {
      // Prisma throws P2025 when no record found — re-throw with a clear message
      throw new Error("Enrollment not found or not active");
    }

    // 2. Persist the session
    const session = await prisma.mentorshipSession.create({
      data: {
        enrollmentId,
        sessionType,
        conductorId,
        sessionDate,
        notes,
      },
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
    const { enrollmentId, toPhaseId, triggeredById, triggeredByRole } = data;

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
          triggeredById,
        },
      });

      const updatedEnrollment = await tx.mentorshipEnrollment.update({
        where: { id: enrollmentId },
        data: { currentPhaseId: toPhaseId },
      });

      return { transition, enrollment: updatedEnrollment };
    });

    return result;
  }
}

export const mentorshipService = new MentorshipService();
