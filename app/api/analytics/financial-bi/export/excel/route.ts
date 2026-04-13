import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFinancialBIData } from "@/lib/services/financial-bi";
import { DateRangeParam } from "@/lib/types/financial-bi";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as { role?: string }).role;
    if (!["ADMIN", "FINANCE"].includes(role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dateRange = (searchParams.get("dateRange") || "last30") as DateRangeParam;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const data = await getFinancialBIData(dateRange, from, to, "all");

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Carreira AI Hub";
    workbook.created = new Date();

    // Sheet 1: Executive Summary
    const summarySheet = workbook.addWorksheet("Executive Summary");
    summarySheet.columns = [
      { header: "Metric", key: "metric", width: 25 },
      { header: "Value", key: "value", width: 20 },
      { header: "vs Previous", key: "change", width: 15 },
      { header: "Status", key: "status", width: 15 },
    ];
    const summaryRows = [
      { metric: "Revenue (Collected)", value: data.summary.revenue.value, change: `${data.summary.revenue.changePct.toFixed(1)}%`, status: data.summary.revenue.context },
      { metric: "Collection Rate", value: `${data.summary.collectionRate.value.toFixed(1)}%`, change: `${data.summary.collectionRate.changePct.toFixed(1)}%`, status: data.summary.collectionRate.context },
      { metric: "Outstanding AR", value: data.summary.outstandingAR.value, change: `${data.summary.outstandingAR.changePct.toFixed(1)}%`, status: data.summary.outstandingAR.context },
      { metric: "MRR", value: data.summary.mrr.value, change: `${data.summary.mrr.changePct.toFixed(1)}%`, status: data.summary.mrr.context },
      { metric: "Top 3 Concentration", value: `${data.summary.topClientConcentration.value.toFixed(1)}%`, change: "", status: data.summary.topClientConcentration.context },
    ];
    summaryRows.forEach((row) => summarySheet.addRow(row));
    summarySheet.addRow({});
    summarySheet.addRow({ metric: "CFO Briefing", value: data.cfoInsight.briefing });

    // Sheet 2: Overdue Invoices
    if (data.arCollections) {
      const overdueSheet = workbook.addWorksheet("Overdue Invoices");
      overdueSheet.columns = [
        { header: "Customer", key: "customerName", width: 25 },
        { header: "Invoice #", key: "invoiceNumber", width: 15 },
        { header: "Amount", key: "amount", width: 15 },
        { header: "Due Date", key: "dueDate", width: 15 },
        { header: "Days Overdue", key: "daysOverdue", width: 15 },
        { header: "Reminders", key: "remindersSent", width: 12 },
        { header: "Calls", key: "collectionCalls", width: 10 },
        { header: "Auto-Charge", key: "autoChargeStatus", width: 15 },
        { header: "Owner", key: "ownerName", width: 20 },
      ];
      data.arCollections.overdueInvoices.forEach((inv) => {
        overdueSheet.addRow({ ...inv, dueDate: new Date(inv.dueDate).toLocaleDateString(), autoChargeStatus: inv.autoChargeStatus || "N/A" });
      });
      overdueSheet.getColumn("amount").numFmt = "$#,##0.00";
    }

    // Sheet 3: Revenue by Month
    if (data.revenueGrowth) {
      const revenueSheet = workbook.addWorksheet("Revenue by Month");
      revenueSheet.columns = [
        { header: "Month", key: "month", width: 15 },
        { header: "Invoiced", key: "invoiced", width: 15 },
        { header: "Collected", key: "collected", width: 15 },
        { header: "Gap", key: "gap", width: 15 },
      ];
      data.revenueGrowth.invoicedVsCollected.forEach((m) => {
        revenueSheet.addRow({ ...m, gap: m.invoiced - m.collected });
      });
      ["invoiced", "collected", "gap"].forEach((col) => {
        revenueSheet.getColumn(col).numFmt = "$#,##0.00";
      });
    }

    // Sheet 4: AR Aging
    if (data.arCollections) {
      const agingSheet = workbook.addWorksheet("AR Aging");
      agingSheet.columns = [
        { header: "Bucket", key: "bucket", width: 15 },
        { header: "Count", key: "count", width: 10 },
        { header: "Amount", key: "amount", width: 15 },
      ];
      data.arCollections.agingBreakdown.forEach((b) => agingSheet.addRow(b));
      agingSheet.getColumn("amount").numFmt = "$#,##0.00";
    }

    // Sheet 5: Customer Analysis
    if (data.customerAnalysis) {
      const custSheet = workbook.addWorksheet("Customer Analysis");
      custSheet.columns = [
        { header: "Customer", key: "customer", width: 25 },
        { header: "Total Paid", key: "totalPaid", width: 15 },
      ];
      data.customerAnalysis.topCustomers.forEach((c) => custSheet.addRow(c));
      custSheet.getColumn("totalPaid").numFmt = "$#,##0.00";
    }

    // Style headers
    workbook.eachSheet((sheet) => {
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE67E22" } };
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="financial-report-${dateRange}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("[FINANCIAL-BI-EXCEL] Error:", error);
    return NextResponse.json({ error: "Failed to generate Excel report" }, { status: 500 });
  }
}
