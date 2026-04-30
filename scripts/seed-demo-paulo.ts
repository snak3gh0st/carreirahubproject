/**
 * Seed realistic demo data for loureiropaulo@gmail.com
 * Run: POSTGRES_PRISMA_URL="..." npx tsx scripts/seed-demo-paulo.ts
 */
import { prisma } from "@/lib/db";

const CID = "abf0c665-3ff9-4abe-8f4e-710baaabc5c7";

async function main() {
  console.log("🌱 Seeding demo data for Paulo Loureiro...\n");

  // ─────────────────────────────────────────────────────────
  // 1. Fix deal title
  // ─────────────────────────────────────────────────────────
  await prisma.deal.updateMany({
    where: { customerId: CID, title: "QuickBooks Import" },
    data: { title: "Mentoria PASS 12x — Paulo Loureiro" },
  });
  console.log("✓ Deal title updated");

  // ─────────────────────────────────────────────────────────
  // 2. Add 3 PAID invoices for Jan / Feb / Mar 2026
  //    (payment history section needs completed invoices)
  // ─────────────────────────────────────────────────────────
  const pastInvoices = [
    { dueDate: new Date("2026-01-29T12:00:00.000Z"), paidAt: new Date("2026-01-28T15:30:00.000Z") },
    { dueDate: new Date("2026-02-28T12:00:00.000Z"), paidAt: new Date("2026-02-27T10:10:00.000Z") },
    { dueDate: new Date("2026-03-29T12:00:00.000Z"), paidAt: new Date("2026-03-29T09:45:00.000Z") },
  ];

  for (const p of pastInvoices) {
    await prisma.invoice.create({
      data: {
        customerId: CID,
        status: "PAID",
        amount: 166.67,
        amountPaid: 166.67,
        dueDate: p.dueDate,
        paidAt: p.paidAt,
        quickbooks_invoice_id: `DEMO-${p.dueDate.getMonth() + 1}`,
      },
    });
  }
  console.log("✓ 3 PAID invoices created (Jan/Feb/Mar 2026)");

  // ─────────────────────────────────────────────────────────
  // 3. Mark April OVERDUE invoice as SENT (for demo clarity)
  //    and promote May DRAFT → SENT so user has one actionable
  // ─────────────────────────────────────────────────────────
  await prisma.invoice.update({
    where: { id: "f2760143-b53d-4138-8fcc-731bb107dbb2" }, // May 2026
    data: { status: "SENT" },
  });
  console.log("✓ May 2026 invoice promoted DRAFT → SENT");

  // ─────────────────────────────────────────────────────────
  // 4. Complete the pending placement test → B1 Intermediate
  // ─────────────────────────────────────────────────────────
  await prisma.placementTest.update({
    where: { id: "cmokwil3j0001l5fzuwdmxscc" },
    data: {
      totalScore: 17,
      percentage: 68.0,
      cefrLevel: "B1",
      displayLevel: "Intermediate (B1)",
      timeSpentSeconds: 1842,
      section1Score: 4,  // A1-A2 Vocabulary
      section2Score: 3,  // A2-B1 Grammar
      section3Score: 3,  // B1 Reading
      section4Score: 4,  // B1-B2 Comprehension
      section5Score: 3,  // B2-C1 Advanced
      answers: {
        q1: 0, q2: 2, q3: 1, q4: 3, q5: 0,
        q6: 1, q7: 2, q8: 0, q9: 3, q10: 1,
        q11: 2, q12: 0, q13: 1, q14: 3, q15: 2,
        q16: 0, q17: 1, q18: 3, q19: 2, q20: 1,
        q21: 0, q22: 3, q23: 1, q24: 2, q25: 0,
      },
    },
  });
  console.log("✓ Placement test completed → B1 Intermediate (68%, 17/25)");

  // ─────────────────────────────────────────────────────────
  // 5. Form assignments: complete onboarding-pass, keep career pending
  // ─────────────────────────────────────────────────────────
  await prisma.formAssignment.update({
    where: { id: "cmnyr3rd80009j4l0zjho5rg2" }, // onboarding-pass
    data: { status: "COMPLETED" },
  });
  console.log("✓ Form onboarding-pass marked COMPLETED");

  // ─────────────────────────────────────────────────────────
  // 6. Advance enrollment to Onboarding phase
  //    (Teste de Inglês is done → next is Onboarding)
  // ─────────────────────────────────────────────────────────
  const onboardingPhase = await prisma.mentorshipPhase.findFirst({
    where: { key: "onboarding" },
  });
  if (onboardingPhase) {
    await prisma.mentorshipEnrollment.update({
      where: { id: "cmnyr3qnz0005j4l0vquxfz0c" },
      data: { currentPhaseId: onboardingPhase.id },
    });
    console.log("✓ Enrollment advanced → Onboarding phase");
  }

  // ─────────────────────────────────────────────────────────
  // 7. Add a DocuSign envelope (signed contract) if model exists
  // ─────────────────────────────────────────────────────────
  try {
    await (prisma as any).docusignEnvelope.upsert({
      where: { envelopeId: "demo-env-paulo-001" },
      update: {},
      create: {
        envelopeId: "demo-env-paulo-001",
        customerId: CID,
        status: "completed",
        subject: "Contrato Mentoria PASS — Paulo Loureiro",
        sentAt: new Date("2026-04-14T15:00:00.000Z"),
        completedAt: new Date("2026-04-14T16:22:00.000Z"),
        documentUrl: null,
      },
    });
    console.log("✓ DocuSign envelope (signed contract) created");
  } catch (e: any) {
    console.log("  ⚠ DocuSign skip:", e.message.split("\n")[0]);
  }

  console.log("\n✅ Demo data seeded successfully!");
  console.log("   Invoices: 3 PAID + 1 OVERDUE + 1 SENT + 9 DRAFT");
  console.log("   Test:     B1 Intermediate, 68% (17/25)");
  console.log("   Phase:    Onboarding");
  console.log("   Forms:    1 COMPLETED + 1 IN_PROGRESS");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
