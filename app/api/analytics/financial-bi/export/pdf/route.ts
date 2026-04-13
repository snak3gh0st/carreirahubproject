import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFinancialBIData } from "@/lib/services/financial-bi";
import { DateRangeParam } from "@/lib/types/financial-bi";
import ReactPDF from "@react-pdf/renderer";
import { PdfReport } from "@/components/financial/export/PdfReport";

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

    const pdfStream = await ReactPDF.renderToStream(
      PdfReport({ data, dateRange })
    );

    const chunks: Uint8Array[] = [];
    for await (const chunk of pdfStream) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const buffer = Buffer.concat(chunks);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="financial-report-${dateRange}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[FINANCIAL-BI-PDF] Error:", error);
    return NextResponse.json({ error: "Failed to generate PDF report" }, { status: 500 });
  }
}
