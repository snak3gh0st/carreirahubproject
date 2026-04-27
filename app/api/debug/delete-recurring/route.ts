import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { quickbooksService } from "@/lib/services/quickbooks.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await quickbooksService.initialize();

  const query = "SELECT Id, RecurringInfo FROM RecurringTransaction MAXRESULTS 50";
  const result = await (quickbooksService as any).request(
    `/query?query=${encodeURIComponent(query)}`
  );

  const templates = result.QueryResponse?.RecurringTransaction || [];
  const results: string[] = [];

  for (const tpl of templates) {
    const name = tpl.RecurringInfo?.Name || tpl.Invoice?.RecurringInfo?.Name || "unknown";
    try {
      await (quickbooksService as any).request(
        `/recurringtransaction/${tpl.Id}`,
        { method: "DELETE" }
      );
      results.push(`Deleted ${tpl.Id} (${name})`);
    } catch (err: any) {
      results.push(`Failed ${tpl.Id} (${name}): ${err.message}`);
    }
  }

  return NextResponse.json({ total: templates.length, results });
}
