import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getHubAuth, verifyCsrf } from "@/lib/hub-auth";
import {
  buildHubJobSearchActivityData,
  getHubJobSearchApiErrorMessage,
  parseHubJobSearchRecordInput,
} from "@/lib/hub/job-search-records";
import { isMissingOpsNativeTable, OPS_NATIVE_MIGRATION_ERROR } from "@/lib/ops/native-schema";

export const dynamic = "force-dynamic";

async function getActiveEnrollment(customerId: string) {
  return prisma.mentorshipEnrollment.findFirst({
    where: { customerId, status: "ACTIVE" },
    select: { id: true },
  });
}

export async function GET(request: NextRequest) {
  const auth = await getHubAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enrollment = await getActiveEnrollment(auth.customerId);
  if (!enrollment) {
    return NextResponse.json({ records: [], enrollmentAvailable: false });
  }

  try {
    const records = await prisma.opsStudentActivity.findMany({
      where: {
        enrollmentId: enrollment.id,
        type: { in: ["APPLICATION", "INTERVIEW", "TASK", "OFFER"] },
      },
      orderBy: [{ activityDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        type: true,
        activityDate: true,
        company: true,
        roleTitle: true,
        area: true,
        industry: true,
        source: true,
        jobUrl: true,
        salary: true,
        status: true,
        outcome: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ records, enrollmentAvailable: true });
  } catch (error) {
    if (isMissingOpsNativeTable(error)) {
      return NextResponse.json(
        { error: OPS_NATIVE_MIGRATION_ERROR, migrationRequired: true },
        { status: 503 }
      );
    }
    console.error("[Hub Job Search] Error listing records:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await getHubAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verifyCsrf(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const enrollment = await getActiveEnrollment(auth.customerId);
  if (!enrollment) {
    return NextResponse.json(
      { error: "Nenhuma matrícula ativa encontrada para registrar sua busca." },
      { status: 404 }
    );
  }

  const parsed = parseHubJobSearchRecordInput(await request.json().catch(() => ({})));
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return NextResponse.json(
      {
        error: getHubJobSearchApiErrorMessage(fieldErrors, "Dados inválidos no registro."),
        fieldErrors,
      },
      { status: 400 }
    );
  }

  try {
    const activity = await prisma.opsStudentActivity.create({
      data: buildHubJobSearchActivityData(parsed.data, enrollment.id),
      select: {
        id: true,
        type: true,
        activityDate: true,
        company: true,
        roleTitle: true,
        source: true,
        jobUrl: true,
        status: true,
        outcome: true,
        notes: true,
      },
    });

    return NextResponse.json({ record: activity }, { status: 201 });
  } catch (error) {
    if (isMissingOpsNativeTable(error)) {
      return NextResponse.json(
        { error: OPS_NATIVE_MIGRATION_ERROR, migrationRequired: true },
        { status: 503 }
      );
    }
    console.error("[Hub Job Search] Error creating record:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
