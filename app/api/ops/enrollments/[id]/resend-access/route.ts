import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { provisionHubAccessForEnrollment } from "@/lib/ops/hub-access-provisioning";
import { isOperationalAccessRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  if (!session?.user || !isOperationalAccessRole(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await provisionHubAccessForEnrollment({ enrollmentId: params.id });
  if (!result.success) {
    if (result.reason === "HUB_ACCESS_PAUSED") {
      return NextResponse.json(
        { error: "Hub access is temporarily paused for new PASS/ADVANCED enrollments." },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    email: result.email,
    expiresAt: result.resetTokenExpiresAt.toISOString(),
  });
}
