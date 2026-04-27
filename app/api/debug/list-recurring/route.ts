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

  const query = "SELECT * FROM RecurringTransaction MAXRESULTS 50";
  const result = await (quickbooksService as any).request(
    `/query?query=${encodeURIComponent(query)}`
  );

  const templates = result.QueryResponse?.RecurringTransaction || [];

  const summary = templates.map((tpl: any) => {
    const info = tpl.RecurringInfo || tpl.Invoice?.RecurringInfo || {};
    const schedule = info.ScheduleInfo || {};
    const invoice = tpl.Invoice || tpl;
    const line = invoice.Line?.[0] || {};
    return {
      id: tpl.Id,
      name: info.Name,
      recurType: info.RecurType,
      active: info.Active,
      schedule: {
        intervalType: schedule.IntervalType,
        numInterval: schedule.NumInterval,
        dayOfMonth: schedule.DayOfMonth,
        startDate: schedule.StartDate,
        endDate: schedule.EndDate,
        nextDate: schedule.NextDate,
        maxOccurrences: schedule.MaxOccurrences,
        remainingOccurrences: schedule.RemainingOccurrences,
      },
      customer: invoice.CustomerRef,
      amount: line.Amount,
      description: line.Description,
      billEmail: invoice.BillEmail,
    };
  });

  return NextResponse.json({ total: templates.length, templates: summary });
}
