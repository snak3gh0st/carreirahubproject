import { NextResponse } from "next/server";

/**
 * POST /api/integrations/bulk-import/pipedrive
 * Pipedrive integration has been removed. Use Clint CRM instead.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Pipedrive integration has been removed. Use Clint CRM instead." },
    { status: 410 }
  );
}
