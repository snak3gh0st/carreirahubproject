import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFinancialBIData } from "@/lib/services/financial-bi";
import { DateRangeParam, FinancialBIResponse } from "@/lib/types/financial-bi";
import PptxGenJS from "pptxgenjs";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const COLORS = {
  dark: "1A1A2E",
  tangerina: "E67E22",
  white: "FFFFFF",
  lightGray: "F5F5F5",
  gray: "888888",
  green: "27AE60",
  red: "E74C3C",
  yellow: "F39C12",
  blue: "3498DB",
};

function fmt(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

function pct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function addTitleSlide(pptx: PptxGenJS, dateRange: string) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.dark };

  slide.addText("Carreira U.S.A.", {
    x: 0.8, y: 1.5, w: 8.4, h: 0.6,
    fontSize: 14, color: COLORS.tangerina, fontFace: "Helvetica",
    bold: true,
  });

  slide.addText("Financial Overview", {
    x: 0.8, y: 2.1, w: 8.4, h: 0.8,
    fontSize: 36, color: COLORS.white, fontFace: "Helvetica", bold: true,
  });

  slide.addText(`Period: ${dateRange} | ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, {
    x: 0.8, y: 3.0, w: 8.4, h: 0.4,
    fontSize: 12, color: COLORS.gray, fontFace: "Helvetica",
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 4.2, w: 2, h: 0.05, fill: { color: COLORS.tangerina },
  });

  slide.addText("CONFIDENTIAL", {
    x: 0.8, y: 4.5, w: 8.4, h: 0.3,
    fontSize: 9, color: COLORS.gray, fontFace: "Helvetica",
  });
}

function addCfoBriefingSlide(pptx: PptxGenJS, data: FinancialBIResponse) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.dark };

  slide.addText("CFO Briefing", {
    x: 0.6, y: 0.3, w: 8.8, h: 0.5,
    fontSize: 22, color: COLORS.tangerina, fontFace: "Helvetica", bold: true,
  });

  slide.addText(data.cfoInsight.briefing, {
    x: 0.6, y: 1.0, w: 8.8, h: 2.5,
    fontSize: 13, color: COLORS.white, fontFace: "Helvetica",
    lineSpacingMultiple: 1.4, valign: "top",
  });

  if (data.cfoInsight.actions.length > 0) {
    slide.addText("Action Items", {
      x: 0.6, y: 3.6, w: 8.8, h: 0.4,
      fontSize: 14, color: COLORS.tangerina, fontFace: "Helvetica", bold: true,
    });

    data.cfoInsight.actions.slice(0, 4).forEach((action, i) => {
      const color = action.severity === "URGENT" ? COLORS.red : action.severity === "WATCH" ? COLORS.yellow : COLORS.blue;
      const y = 4.1 + i * 0.4;

      slide.addText(`[${action.severity}]  ${action.description}`, {
        x: 0.6, y, w: 8.8, h: 0.35,
        fontSize: 10, color, fontFace: "Helvetica",
      });
    });
  }
}

function addKpiSlide(pptx: PptxGenJS, data: FinancialBIResponse) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };

  slide.addText("Key Financial Metrics", {
    x: 0.6, y: 0.3, w: 8.8, h: 0.5,
    fontSize: 22, color: COLORS.dark, fontFace: "Helvetica", bold: true,
  });

  const kpis = [
    { label: "Revenue (Collected)", value: fmt(data.summary.revenue.value), change: pct(data.summary.revenue.changePct), level: data.summary.revenue.contextLevel },
    { label: "Collection Rate", value: `${data.summary.collectionRate.value.toFixed(1)}%`, change: pct(data.summary.collectionRate.changePct), level: data.summary.collectionRate.contextLevel },
    { label: "Outstanding AR", value: fmt(data.summary.outstandingAR.value), change: pct(data.summary.outstandingAR.changePct), level: data.summary.outstandingAR.contextLevel },
    { label: "MRR", value: fmt(data.summary.mrr.value), change: pct(data.summary.mrr.changePct), level: data.summary.mrr.contextLevel },
    { label: "Top 3 Concentration", value: `${data.summary.topClientConcentration.value.toFixed(1)}%`, change: "", level: data.summary.topClientConcentration.contextLevel },
  ];

  const cardW = 1.7;
  const gap = 0.15;
  const startX = 0.6;
  const y = 1.2;

  kpis.forEach((kpi, i) => {
    const x = startX + i * (cardW + gap);
    const changeColor = kpi.level === "good" ? COLORS.green : kpi.level === "danger" ? COLORS.red : COLORS.yellow;

    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w: cardW, h: 1.6, fill: { color: COLORS.lightGray }, rectRadius: 0.1,
    });

    slide.addText(kpi.label, {
      x, y: y + 0.15, w: cardW, h: 0.3,
      fontSize: 9, color: COLORS.gray, fontFace: "Helvetica", align: "center",
    });

    slide.addText(kpi.value, {
      x, y: y + 0.5, w: cardW, h: 0.5,
      fontSize: 24, color: COLORS.dark, fontFace: "Helvetica", bold: true, align: "center",
    });

    if (kpi.change) {
      slide.addText(kpi.change, {
        x, y: y + 1.05, w: cardW, h: 0.3,
        fontSize: 11, color: changeColor, fontFace: "Helvetica", align: "center", bold: true,
      });
    }
  });

  if (data.pnl) {
    const pnlY = 3.2;

    slide.addText("Profit & Loss Snapshot", {
      x: 0.6, y: pnlY, w: 8.8, h: 0.4,
      fontSize: 14, color: COLORS.dark, fontFace: "Helvetica", bold: true,
    });

    const pnlCards = [
      { label: "Total Revenue", value: fmt(data.pnl.totalRevenue) },
      { label: "Total Expenses", value: fmt(data.pnl.totalExpenses) },
      { label: "Net Income", value: fmt(data.pnl.netIncome) },
      { label: "Margin", value: `${data.pnl.marginPct.toFixed(1)}%` },
      { label: "Burn Rate", value: `${fmt(data.pnl.burnRate)}/mo` },
      { label: "Cash on Hand", value: fmt(data.pnl.cashOnHand) },
    ];

    const pnlCardW = 1.4;
    const pnlGap = 0.12;

    pnlCards.forEach((card, i) => {
      const x = 0.6 + i * (pnlCardW + pnlGap);

      slide.addShape(pptx.ShapeType.roundRect, {
        x, y: pnlY + 0.5, w: pnlCardW, h: 1.0, fill: { color: COLORS.lightGray }, rectRadius: 0.08,
      });

      slide.addText(card.label, {
        x, y: pnlY + 0.6, w: pnlCardW, h: 0.25,
        fontSize: 8, color: COLORS.gray, fontFace: "Helvetica", align: "center",
      });

      slide.addText(card.value, {
        x, y: pnlY + 0.85, w: pnlCardW, h: 0.4,
        fontSize: 18, color: COLORS.dark, fontFace: "Helvetica", bold: true, align: "center",
      });
    });
  }
}

function addArAgingSlide(pptx: PptxGenJS, data: FinancialBIResponse) {
  if (!data.arCollections) return;

  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };

  slide.addText("AR Aging & Collections", {
    x: 0.6, y: 0.3, w: 8.8, h: 0.5,
    fontSize: 22, color: COLORS.dark, fontFace: "Helvetica", bold: true,
  });

  const rows: PptxGenJS.TableRow[] = [
    [
      { text: "Aging Bucket", options: { bold: true, color: COLORS.white, fill: { color: COLORS.tangerina }, fontSize: 10 } },
      { text: "Count", options: { bold: true, color: COLORS.white, fill: { color: COLORS.tangerina }, fontSize: 10, align: "center" } },
      { text: "Amount", options: { bold: true, color: COLORS.white, fill: { color: COLORS.tangerina }, fontSize: 10, align: "right" } },
    ],
    ...data.arCollections.agingBreakdown.map((b) => [
      { text: b.bucket, options: { fontSize: 10 } },
      { text: String(b.count), options: { fontSize: 10, align: "center" as const } },
      { text: fmt(b.amount), options: { fontSize: 10, align: "right" as const } },
    ]),
  ];

  slide.addTable(rows, {
    x: 0.6, y: 1.0, w: 4.0,
    border: { type: "solid", pt: 0.5, color: "DDDDDD" },
    colW: [1.6, 0.8, 1.6],
    rowH: 0.35,
  });

  if (data.arCollections.overdueInvoices.length > 0) {
    slide.addText("Top Overdue Invoices", {
      x: 5.2, y: 0.85, w: 4.4, h: 0.3,
      fontSize: 12, color: COLORS.dark, fontFace: "Helvetica", bold: true,
    });

    const overdueRows: PptxGenJS.TableRow[] = [
      [
        { text: "Customer", options: { bold: true, color: COLORS.white, fill: { color: COLORS.tangerina }, fontSize: 9 } },
        { text: "Amount", options: { bold: true, color: COLORS.white, fill: { color: COLORS.tangerina }, fontSize: 9, align: "right" } },
        { text: "Days", options: { bold: true, color: COLORS.white, fill: { color: COLORS.tangerina }, fontSize: 9, align: "center" } },
      ],
      ...data.arCollections.overdueInvoices.slice(0, 8).map((inv) => [
        { text: inv.customerName.substring(0, 20), options: { fontSize: 9 } },
        { text: fmt(inv.amount), options: { fontSize: 9, align: "right" as const } },
        { text: `${inv.daysOverdue}d`, options: { fontSize: 9, align: "center" as const, color: inv.daysOverdue > 60 ? COLORS.red : COLORS.yellow } },
      ]),
    ];

    slide.addTable(overdueRows, {
      x: 5.2, y: 1.2, w: 4.4,
      border: { type: "solid", pt: 0.5, color: "DDDDDD" },
      colW: [2.0, 1.2, 1.2],
      rowH: 0.3,
    });
  }
}

function addReceivablesProjectionSlide(pptx: PptxGenJS, data: FinancialBIResponse) {
  if (!data.receivablesProjection) return;

  const rp = data.receivablesProjection;
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };

  slide.addText("Inadimplência & Projeção de Recebíveis", {
    x: 0.6, y: 0.3, w: 8.8, h: 0.5,
    fontSize: 22, color: COLORS.dark, fontFace: "Helvetica", bold: true,
  });

  // Delinquency KPI boxes
  const cards = [
    { label: "Total AR", value: fmt(rp.delinquency.totalAR), color: COLORS.dark },
    { label: "Em Atraso", value: fmt(rp.delinquency.totalDelinquent), color: COLORS.red },
    { label: "Inadimplência", value: `${rp.delinquency.delinquencyRate.toFixed(1)}%`, color: COLORS.red },
    { label: "Recuperação Est.", value: fmt(rp.delinquency.estimatedRecovery), color: COLORS.green },
    { label: "Perda Estimada", value: fmt(rp.delinquency.estimatedLoss), color: COLORS.yellow },
  ];

  const cardW = 1.75;
  const cardH = 0.8;
  const cardY = 0.9;
  cards.forEach((card, idx) => {
    const x = 0.4 + idx * (cardW + 0.2);
    slide.addShape(pptx.ShapeType.rect, {
      x, y: cardY, w: cardW, h: cardH,
      fill: { color: COLORS.lightGray }, line: { color: "DDDDDD", pt: 0.5 },
    });
    slide.addText(card.label, {
      x, y: cardY + 0.08, w: cardW, h: 0.25,
      fontSize: 8, color: COLORS.gray, fontFace: "Helvetica", align: "center",
    });
    slide.addText(card.value, {
      x, y: cardY + 0.3, w: cardW, h: 0.4,
      fontSize: 16, color: card.color, fontFace: "Helvetica", bold: true, align: "center",
    });
  });

  const hasBep = rp.monthlyBreakeven > 0;

  // Monthly projection table title + optional breakeven badge
  slide.addText("Projeção Mensal de Recebíveis (6 meses)", {
    x: 0.6, y: 1.9, w: hasBep ? 6.5 : 9.0, h: 0.3,
    fontSize: 12, color: COLORS.dark, fontFace: "Helvetica", bold: true,
  });
  if (hasBep) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 7.2, y: 1.87, w: 2.4, h: 0.35,
      fill: { color: "EDE9FE" }, line: { color: "7C3AED", pt: 0.5 },
    });
    slide.addText(`Breakeven: ${fmt(rp.monthlyBreakeven)}/mês`, {
      x: 7.2, y: 1.87, w: 2.4, h: 0.35,
      fontSize: 9, color: "7C3AED", fontFace: "Helvetica", bold: true, align: "center", valign: "middle",
    });
  }

  const bepCol = hasBep
    ? [{ text: "vs BEP", options: { bold: true, color: COLORS.white, fill: { color: COLORS.tangerina }, fontSize: 9, align: "right" as const } }]
    : [];

  const projRows: PptxGenJS.TableRow[] = [
    [
      { text: "Mês", options: { bold: true, color: COLORS.white, fill: { color: COLORS.tangerina }, fontSize: 9 } },
      { text: "Fat.", options: { bold: true, color: COLORS.white, fill: { color: COLORS.tangerina }, fontSize: 9, align: "center" } },
      { text: "Total a Rec.", options: { bold: true, color: COLORS.white, fill: { color: COLORS.tangerina }, fontSize: 9, align: "right" } },
      { text: "Em Atraso", options: { bold: true, color: COLORS.white, fill: { color: COLORS.tangerina }, fontSize: 9, align: "right" } },
      { text: "Esperado", options: { bold: true, color: COLORS.white, fill: { color: COLORS.tangerina }, fontSize: 9, align: "right" } },
      { text: "Conservador", options: { bold: true, color: COLORS.white, fill: { color: COLORS.tangerina }, fontSize: 9, align: "right" } },
      ...bepCol,
    ],
    ...rp.monthlyProjection.map((row) => {
      const gap = row.collectionExpected - rp.monthlyBreakeven;
      const bepCell = hasBep
        ? [{ text: gap >= 0 ? `+${fmt(gap)}` : `-${fmt(Math.abs(gap))}`, options: { fontSize: 9, align: "right" as const, color: gap >= 0 ? COLORS.green : COLORS.red, bold: true } }]
        : [];
      return [
        { text: row.monthLabel, options: { fontSize: 9 } },
        { text: String(row.invoiceCount), options: { fontSize: 9, align: "center" as const } },
        { text: fmt(row.totalDue), options: { fontSize: 9, align: "right" as const } },
        { text: row.delinquentAmount > 0 ? fmt(row.delinquentAmount) : "—", options: { fontSize: 9, align: "right" as const, color: row.delinquentAmount > 0 ? COLORS.red : COLORS.gray } },
        { text: fmt(row.collectionExpected), options: { fontSize: 9, align: "right" as const, color: COLORS.green } },
        { text: fmt(row.conservative), options: { fontSize: 9, align: "right" as const, color: COLORS.yellow } },
        ...bepCell,
      ];
    }),
    // Totals row
    [
      { text: "TOTAL", options: { bold: true, fontSize: 9, fill: { color: "E8E8E8" } } },
      { text: String(rp.monthlyProjection.reduce((s, r) => s + r.invoiceCount, 0)), options: { bold: true, fontSize: 9, align: "center" as const, fill: { color: "E8E8E8" } } },
      { text: fmt(rp.monthlyProjection.reduce((s, r) => s + r.totalDue, 0)), options: { bold: true, fontSize: 9, align: "right" as const, fill: { color: "E8E8E8" } } },
      { text: fmt(rp.monthlyProjection.reduce((s, r) => s + r.delinquentAmount, 0)), options: { bold: true, fontSize: 9, align: "right" as const, color: COLORS.red, fill: { color: "E8E8E8" } } },
      { text: fmt(rp.monthlyProjection.reduce((s, r) => s + r.collectionExpected, 0)), options: { bold: true, fontSize: 9, align: "right" as const, color: COLORS.green, fill: { color: "E8E8E8" } } },
      { text: fmt(rp.monthlyProjection.reduce((s, r) => s + r.conservative, 0)), options: { bold: true, fontSize: 9, align: "right" as const, color: COLORS.yellow, fill: { color: "E8E8E8" } } },
      ...(hasBep ? [{ text: `BEP: ${fmt(rp.monthlyBreakeven)}/mês`, options: { bold: true, fontSize: 9, align: "right" as const, color: "7C3AED", fill: { color: "E8E8E8" } } }] : []),
    ],
  ];

  const colW = hasBep ? [1.3, 0.7, 1.4, 1.3, 1.5, 1.5, 1.3] : [1.5, 0.9, 1.6, 1.5, 1.7, 1.8];
  slide.addTable(projRows, {
    x: 0.6, y: 2.2, w: 9.0,
    border: { type: "solid", pt: 0.5, color: "DDDDDD" },
    colW,
    rowH: 0.32,
  });
}

function addExpensesSlide(pptx: PptxGenJS, data: FinancialBIResponse) {
  if (!data.pnl?.expensesByCategory?.length) return;

  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };

  slide.addText("Expense Breakdown", {
    x: 0.6, y: 0.3, w: 8.8, h: 0.5,
    fontSize: 22, color: COLORS.dark, fontFace: "Helvetica", bold: true,
  });

  const rows: PptxGenJS.TableRow[] = [
    [
      { text: "Category", options: { bold: true, color: COLORS.white, fill: { color: COLORS.tangerina }, fontSize: 10 } },
      { text: "Amount", options: { bold: true, color: COLORS.white, fill: { color: COLORS.tangerina }, fontSize: 10, align: "right" } },
      { text: "% of Total", options: { bold: true, color: COLORS.white, fill: { color: COLORS.tangerina }, fontSize: 10, align: "center" } },
    ],
    ...data.pnl.expensesByCategory.slice(0, 10).map((c) => [
      { text: c.category, options: { fontSize: 10 } },
      { text: fmt(c.amount), options: { fontSize: 10, align: "right" as const } },
      { text: `${c.pctOfTotal.toFixed(1)}%`, options: { fontSize: 10, align: "center" as const } },
    ]),
  ];

  slide.addTable(rows, {
    x: 0.6, y: 1.0, w: 8.8,
    border: { type: "solid", pt: 0.5, color: "DDDDDD" },
    colW: [4.0, 2.4, 2.4],
    rowH: 0.35,
  });

  slide.addText([
    { text: "Burn Rate: ", options: { bold: true } },
    { text: `${fmt(data.pnl.burnRate)}/month`, options: {} },
    { text: "   |   ", options: { color: COLORS.gray } },
    { text: "Runway: ", options: { bold: true } },
    { text: `${data.pnl.runwayMonths.toFixed(0)} months`, options: {} },
    { text: "   |   ", options: { color: COLORS.gray } },
    { text: "Cash on Hand: ", options: { bold: true } },
    { text: fmt(data.pnl.cashOnHand), options: {} },
  ], {
    x: 0.6, y: 4.5, w: 8.8, h: 0.4,
    fontSize: 11, color: COLORS.dark, fontFace: "Helvetica",
  });
}

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

    const pptx = new PptxGenJS();
    pptx.author = "Carreira AI Hub";
    pptx.company = "Carreira U.S.A.";
    pptx.title = `Financial Overview — ${dateRange}`;
    pptx.layout = "LAYOUT_WIDE";

    addTitleSlide(pptx, dateRange);
    addCfoBriefingSlide(pptx, data);
    addKpiSlide(pptx, data);
    addReceivablesProjectionSlide(pptx, data);
    addArAgingSlide(pptx, data);
    addExpensesSlide(pptx, data);

    const raw = await pptx.write({ outputType: "nodebuffer" }) as Buffer;
    const buffer = new Uint8Array(raw);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="financial-presentation-${dateRange}.pptx"`,
      },
    });
  } catch (error) {
    console.error("[FINANCIAL-BI-PPTX] Error:", error);
    return NextResponse.json({ error: "Failed to generate presentation" }, { status: 500 });
  }
}
