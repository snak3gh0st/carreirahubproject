import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mentorshipService } from "@/lib/services/mentorship.service";
import { OPS_SESSION_TYPES } from "@/lib/ops/workflow";
import { isOperationalAccessRole } from "@/lib/roles";
import { OPS_SESSION_STATUSES, normalizeOpsSessionStatus } from "@/lib/ops/visibility";
import { buildOperationalActorPayload } from "@/lib/ops/staff-members";
import {
  buildDigisacLifecycleDedupeKey,
  sendDigisacLifecycleMessageSafely,
} from "@/lib/ops/digisac-lifecycle";
import { z } from "zod";

export const dynamic = "force-dynamic";

const sessionSchema = z.object({
  enrollmentId: z.string().min(1),
  sessionType: z.enum(OPS_SESSION_TYPES),
  conductorId: z.string().optional(),
  actorId: z.string().optional(),
  sessionDate: z.string().min(1),
  status: z.enum(OPS_SESSION_STATUSES).optional(),
  rescheduleCount: z.union([z.number(), z.string()]).optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role;

  if (!isOperationalAccessRole(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = sessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { enrollmentId, sessionType, conductorId, actorId, sessionDate, notes } = parsed.data;
  const rescheduleCount = parsed.data.rescheduleCount === undefined
    ? 0
    : Math.max(0, Math.round(Number(parsed.data.rescheduleCount) || 0));
  let actor;
  try {
    actor = buildOperationalActorPayload(actorId ?? (conductorId ? `user:${conductorId}` : ""), (session.user as any).id);
  } catch {
    return NextResponse.json({ error: "Funcionario selecionado invalido" }, { status: 400 });
  }

  try {
    const sessionDateObj = new Date(sessionDate);
    const normalizedStatus = normalizeOpsSessionStatus(parsed.data.status);
    const result = await mentorshipService.logSession({
      enrollmentId,
      sessionType,
      conductorId: actor.sessionConductorId,
      performedByUserId: actor.performedByUserId,
      performedByStaffId: actor.performedByStaffId,
      sessionDate: sessionDateObj,
      status: normalizedStatus,
      rescheduleCount,
      notes,
    });

    // Notify the customer only when the session is in the FUTURE (i.e., a scheduling event).
    // Past sessions are being LOGGED for record-keeping and don't need a notification.
    const isFutureScheduled =
      sessionDateObj.getTime() > Date.now() && normalizedStatus !== "CANCELADO";
    const digisacLifecycle = isFutureScheduled
      ? await (async () => {
          const conductor = actor.sessionConductorId
            ? await prisma.user.findUnique({
                where: { id: actor.sessionConductorId },
                select: { name: true },
              })
            : null;
          return sendDigisacLifecycleMessageSafely({
            event: "session_scheduled",
            enrollmentId,
            dedupeKey: buildDigisacLifecycleDedupeKey("session_scheduled", result.id),
            sessionDate: sessionDateObj,
            sessionType,
            conductorName: conductor?.name ?? null,
            metadata: {
              source: "ops.sessions",
              sessionId: result.id,
              status: normalizedStatus,
            },
          });
        })()
      : null;

    return NextResponse.json({ session: result, digisacLifecycle }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Enrollment not found or not active") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[Ops Sessions Error]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
