import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getHubAuth } from "@/lib/hub-auth";
import { ContractStatus, InvoiceStatus, FormAssignmentStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export interface ProcessStep {
  id: string;
  label: string;
  labelPt: string;
  status: "completed" | "current" | "pending";
  detail?: string;
  detailPt?: string;
}

/**
 * GET /api/hub/status
 *
 * Returns the client's process status — automatically computed from system data.
 * Steps: Contract → Payment → Onboarding → English Test → In Progress
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getHubAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { customerId } = auth;

    // Fetch all relevant data in parallel
    const [contracts, invoices, formAssignments, placementTest] = await Promise.all([
      prisma.contract.findMany({
        where: { customerId },
        select: { status: true, signedAt: true },
      }),
      prisma.invoice.findMany({
        where: { customerId },
        select: { status: true, paidAt: true, amount: true, amountPaid: true },
      }),
      prisma.formAssignment.findMany({
        where: { customerId },
        select: { status: true },
      }),
      prisma.placementTest.findFirst({
        where: { customerId },
        orderBy: { createdAt: "desc" },
        select: { displayLevel: true, cefrLevel: true },
      }),
    ]);

    // 1. Contract: at least one SIGNED
    const contractSigned = contracts.some((c) => c.status === ContractStatus.SIGNED);
    const contractDate = contracts.find((c) => c.status === ContractStatus.SIGNED)?.signedAt;

    // 2. Payment: at least one invoice PAID
    const anyPaid = invoices.some((i) => i.status === InvoiceStatus.PAID);
    const paidCount = invoices.filter((i) => i.status === InvoiceStatus.PAID).length;
    const totalCount = invoices.length;

    // 3. Onboarding: all assigned forms COMPLETED (or none assigned = skip)
    const totalForms = formAssignments.length;
    const completedForms = formAssignments.filter((f) => f.status === FormAssignmentStatus.COMPLETED).length;
    const onboardingDone = totalForms === 0 ? null : completedForms === totalForms; // null = no forms assigned

    // 4. English Test: test taken
    const testDone = !!placementTest;

    // Build steps
    const steps: ProcessStep[] = [];

    // Step 1: Contract
    steps.push({
      id: "contract",
      label: "Contract",
      labelPt: "Contrato",
      status: contractSigned ? "completed" : "current",
      detail: contractSigned
        ? `Signed${contractDate ? ` on ${new Date(contractDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}`
        : "Pending signature",
      detailPt: contractSigned
        ? `Assinado${contractDate ? ` em ${new Date(contractDate).toLocaleDateString("pt-BR")}` : ""}`
        : "Pendente de assinatura",
    });

    // Step 2: Payment
    steps.push({
      id: "payment",
      label: "Payment",
      labelPt: "Pagamento",
      status: anyPaid ? "completed" : contractSigned ? "current" : "pending",
      detail: anyPaid ? `${paidCount}/${totalCount} invoices paid` : "Awaiting first payment",
      detailPt: anyPaid ? `${paidCount}/${totalCount} faturas pagas` : "Aguardando primeiro pagamento",
    });

    // Step 3: Onboarding (only if forms assigned)
    if (onboardingDone !== null) {
      steps.push({
        id: "onboarding",
        label: "Onboarding",
        labelPt: "Onboarding",
        status: onboardingDone ? "completed" : anyPaid ? "current" : "pending",
        detail: onboardingDone ? "All forms completed" : `${completedForms}/${totalForms} forms completed`,
        detailPt: onboardingDone ? "Todos os formulários preenchidos" : `${completedForms}/${totalForms} formulários preenchidos`,
      });
    }

    // Step 4: English Test
    steps.push({
      id: "english-test",
      label: "English Test",
      labelPt: "Teste de Inglês",
      status: testDone ? "completed" : anyPaid ? "current" : "pending",
      detail: testDone ? `Level: ${placementTest.displayLevel} (${placementTest.cefrLevel})` : "Not taken yet",
      detailPt: testDone ? `Nível: ${placementTest.displayLevel} (${placementTest.cefrLevel})` : "Ainda não realizado",
    });

    // Step 5: In Progress (all previous completed)
    const allPriorDone = contractSigned && anyPaid && (onboardingDone === null || onboardingDone) && testDone;
    steps.push({
      id: "in-progress",
      label: "In Progress",
      labelPt: "Em Andamento",
      status: allPriorDone ? "completed" : "pending",
      detail: allPriorDone ? "All steps completed — your process is active" : "Complete previous steps",
      detailPt: allPriorDone ? "Todas as etapas concluídas — seu processo está ativo" : "Complete as etapas anteriores",
    });

    // Calculate overall progress
    const completedCount = steps.filter((s) => s.status === "completed").length;
    const progress = Math.round((completedCount / steps.length) * 100);

    return NextResponse.json({ steps, progress });
  } catch (error: any) {
    console.error("[HUB_STATUS] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
