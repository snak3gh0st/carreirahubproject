# Ops Hub — "Minhas Tarefas" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Clickup with a native "Minhas Tarefas" page in the ops hub — each team member sees their phase queue, marks checklist items per student, and logs sessions without leaving the page.

**Architecture:** New Prisma model `PhaseChecklistProgress` tracks per-enrollment item completion. Checklist templates live in `lib/ops/phase-checklists.ts` (mirrors FORM_TEMPLATES pattern). A client-side two-panel UI (queue + detail) is powered by React Query hitting two new API routes. Session logging auto-marks checklist session items. Phase-to-user assignment is managed by the coordinator page.

**Tech Stack:** Next.js 14 App Router, Prisma (PostgreSQL/Neon), React Query, TypeScript strict, Lucide icons, Tailwind CSS (brand-verde / brand-tangerina / brand-creme tokens).

---

## File Map

| Action | Path |
|--------|------|
| **Modify** | `prisma/schema.prisma` — add `assignedPhases` to User, add `PhaseChecklistProgress` model |
| **Create** | `lib/ops/phase-checklists.ts` — checklist templates + session auto-complete map |
| **Modify** | `lib/services/mentorship.service.ts` — auto-mark session items on logSession |
| **Create** | `app/api/ops/my-tasks/route.ts` — GET queue for logged-in user |
| **Create** | `app/api/ops/my-tasks/[enrollmentId]/checklist/route.ts` — POST toggle item |
| **Create** | `app/api/ops/coordinator/phases/[userId]/route.ts` — PATCH assignedPhases |
| **Create** | `app/ops/my-tasks/MyTasksClient.tsx` — two-panel client component |
| **Create** | `app/ops/my-tasks/page.tsx` — server page wrapper |
| **Create** | `app/ops/coordinator/PhaseAssignment.tsx` — phase-to-user assignment UI |
| **Modify** | `app/ops/coordinator/page.tsx` — add PhaseAssignment section |
| **Modify** | `components/ops/ops-sidebar.tsx` — add "Minhas Tarefas" nav item |

---

## Task 1: Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `assignedPhases` field to User model**

In `prisma/schema.prisma`, inside `model User { ... }`, add after the `aiRateLimit` line (line 36):

```prisma
  assignedPhases         String[]               @default([])
  checklistProgress      PhaseChecklistProgress[] @relation("CompletedByUser")
```

- [ ] **Step 2: Add `checklistProgress` relation to MentorshipEnrollment**

In `prisma/schema.prisma`, inside `model MentorshipEnrollment { ... }`, add after the `transitions` line (after `transitions PhaseTransition[]`):

```prisma
  checklistProgress PhaseChecklistProgress[]
```

- [ ] **Step 3: Add the PhaseChecklistProgress model**

After the `PhaseTransition` model block (around line 960), add:

```prisma
model PhaseChecklistProgress {
  id            String    @id @default(cuid())
  phaseKey      String
  itemKey       String
  completedAt   DateTime?
  createdAt     DateTime  @default(now())

  enrollmentId  String
  enrollment    MentorshipEnrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  completedById String?
  completedBy   User?     @relation("CompletedByUser", fields: [completedById], references: [id])

  @@unique([enrollmentId, phaseKey, itemKey])
  @@index([enrollmentId])
  @@map("phase_checklist_progress")
}
```

- [ ] **Step 4: Push schema to database**

```bash
npm run db:generate && npm run db:push
```

Expected: `✓ Your database is now in sync with your Prisma schema.`

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add PhaseChecklistProgress model and assignedPhases to User"
```

---

## Task 2: Phase Checklist Config

**Files:**
- Create: `lib/ops/phase-checklists.ts`

- [ ] **Step 1: Create the config file**

```typescript
// lib/ops/phase-checklists.ts

export type ChecklistItemType = "whatsapp" | "form" | "session" | "doc" | "advance";

export interface ChecklistItem {
  key: string;
  label: string;
  type: ChecklistItemType;
  /** System marks this automatically (do not show manual checkbox) */
  autoComplete?: boolean;
  /** Only enabled when all previous items in the list are completed */
  requiresAll?: boolean;
}

export const PHASE_CHECKLISTS: Record<string, ChecklistItem[]> = {
  bastao: [
    { key: "welcome_whatsapp",         label: "Boas-vindas enviada por WhatsApp",    type: "whatsapp" },
    { key: "onboarding_form_assigned", label: "Formulário de Onboarding atribuído",  type: "form" },
    { key: "onboarding_form_completed",label: "Formulário de Onboarding respondido", type: "form", autoComplete: true },
    { key: "session_1",                label: "1ª Sessão realizada",                 type: "session", autoComplete: true },
    { key: "session_2",                label: "2ª Sessão realizada",                 type: "session", autoComplete: true },
    { key: "summary_whatsapp",         label: "Resumo da fase enviado ao aluno",     type: "whatsapp" },
    { key: "vision_doc",               label: "Documento de Visão revisado",         type: "doc" },
    { key: "advance_phase",            label: "Aluno avançado para próxima fase",    type: "advance", requiresAll: true },
  ],
  // TODO: define checklist items for each additional phase below.
  // Follow the bastao pattern. Use the exact phase key from mentorship_phases.key in the DB.
  // Example stub for each phase:
  // ancora: [
  //   { key: "session_1", label: "1ª Sessão de Âncora", type: "session", autoComplete: true },
  //   { key: "advance_phase", label: "Aluno avançado para próxima fase", type: "advance", requiresAll: true },
  // ],
};

/**
 * Maps a phase key to the ordered list of session item keys.
 * When a session is logged, the system looks up the session count and marks
 * the nth session key (e.g. 1st session → session_1).
 */
export const SESSION_ITEM_SEQUENCE: Record<string, string[]> = {
  bastao: ["session_1", "session_2"],
  // Add other phases here matching their session item keys.
};

export function getPhaseChecklist(phaseKey: string): ChecklistItem[] {
  return PHASE_CHECKLISTS[phaseKey] ?? [];
}

export function getSessionItemKey(phaseKey: string, sessionCount: number): string | null {
  const sequence = SESSION_ITEM_SEQUENCE[phaseKey];
  if (!sequence) return null;
  return sequence[sessionCount - 1] ?? null;
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/ops/phase-checklists.ts
git commit -m "feat(ops): add phase checklist config with bastao template"
```

---

## Task 3: Auto-Complete Sessions in MentorshipService

**Files:**
- Modify: `lib/services/mentorship.service.ts`

- [ ] **Step 1: Add checklist auto-complete to `logSession`**

In `lib/services/mentorship.service.ts`, add the import at the top of the file (after existing imports):

```typescript
import { getSessionItemKey } from "@/lib/ops/phase-checklists";
```

Then replace the `logSession` method body (starting at line 143) with:

```typescript
  async logSession(data: LogSessionInput) {
    const { enrollmentId, sessionType, conductorId, sessionDate, notes } = data;

    const enrollment = await prisma.mentorshipEnrollment.findFirstOrThrow({
      where: { id: enrollmentId, status: "ACTIVE" },
      include: { currentPhase: true },
    }).catch(() => {
      throw new Error("Enrollment not found or not active");
    });

    const session = await prisma.mentorshipSession.create({
      data: { enrollmentId, sessionType, conductorId, sessionDate, notes },
    });

    // Auto-mark the nth session checklist item for this phase.
    const phaseKey = enrollment.currentPhase?.key;
    if (phaseKey) {
      const sessionCount = await prisma.mentorshipSession.count({
        where: { enrollmentId },
      });
      const itemKey = getSessionItemKey(phaseKey, sessionCount);
      if (itemKey) {
        await prisma.phaseChecklistProgress.upsert({
          where: { enrollmentId_phaseKey_itemKey: { enrollmentId, phaseKey, itemKey } },
          create: { enrollmentId, phaseKey, itemKey, completedAt: new Date(), completedById: conductorId },
          update: { completedAt: new Date(), completedById: conductorId },
        });
      }
    }

    return session;
  }
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/services/mentorship.service.ts
git commit -m "feat(mentorship): auto-mark checklist session items when session is logged"
```

---

## Task 4: API — GET /api/ops/my-tasks

**Files:**
- Create: `app/api/ops/my-tasks/route.ts`

- [ ] **Step 1: Create the GET route**

```typescript
// app/api/ops/my-tasks/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPhaseChecklist } from "@/lib/ops/phase-checklists";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const userRole = (session.user as any).role;
  if (!["ADMIN", "OPERATIONAL"].includes(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  // ADMIN sees all active enrollments; others see only their assigned phases.
  const phaseFilter = userRole === "ADMIN"
    ? {}
    : { currentPhase: { key: { in: user.assignedPhases } } };

  const enrollments = await prisma.mentorshipEnrollment.findMany({
    where: { status: "ACTIVE", ...phaseFilter },
    include: {
      customer: { select: { name: true } },
      currentPhase: { select: { key: true, label: true } },
      sessions: { orderBy: { sessionDate: "desc" }, take: 1, select: { sessionDate: true } },
      checklistProgress: { where: { completedAt: { not: null } }, select: { phaseKey: true, itemKey: true, completedAt: true } },
      assignedTo: { select: { name: true } },
    },
    orderBy: { startDate: "asc" },
  });

  const now = Date.now();

  const result = enrollments.map((e) => {
    const phaseKey = e.currentPhase?.key ?? "";
    const template = getPhaseChecklist(phaseKey);
    const completedKeys = new Set(
      e.checklistProgress
        .filter((p) => p.phaseKey === phaseKey && p.completedAt !== null)
        .map((p) => p.itemKey)
    );

    const lastSessionDate = e.sessions[0]?.sessionDate ?? null;
    const daysSinceLastSession = lastSessionDate
      ? Math.floor((now - new Date(lastSessionDate).getTime()) / 86400000)
      : null;

    return {
      enrollmentId: e.id,
      studentName: e.customer.name,
      programType: e.programType,
      phaseKey,
      phaseLabel: e.currentPhase?.label ?? phaseKey,
      assigneeName: e.assignedTo?.name ?? null,
      startDate: e.startDate.toISOString(),
      sessionCount: e.sessions.length,
      daysSinceLastSession,
      checklistProgress: {
        completed: template.filter((i) => completedKeys.has(i.key)).length,
        total: template.length,
        items: template.map((item) => ({
          key: item.key,
          label: item.label,
          type: item.type,
          autoComplete: item.autoComplete ?? false,
          requiresAll: item.requiresAll ?? false,
          completedAt: e.checklistProgress.find(
            (p) => p.phaseKey === phaseKey && p.itemKey === item.key
          )?.completedAt?.toISOString() ?? null,
        })),
      },
    };
  });

  // Sort: most urgent first — 0% progress, then most days since last session
  result.sort((a, b) => {
    const aPct = a.checklistProgress.total > 0
      ? a.checklistProgress.completed / a.checklistProgress.total : 1;
    const bPct = b.checklistProgress.total > 0
      ? b.checklistProgress.completed / b.checklistProgress.total : 1;
    if (aPct !== bPct) return aPct - bPct;
    return (b.daysSinceLastSession ?? 0) - (a.daysSinceLastSession ?? 0);
  });

  return NextResponse.json({ enrollments: result });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Test the endpoint manually**

Start dev server (`npm run dev`) and visit `http://localhost:3000/api/ops/my-tasks` while logged in as an ops user.
Expected: `{ "enrollments": [...] }` — even if empty array.

- [ ] **Step 4: Commit**

```bash
git add app/api/ops/my-tasks/route.ts
git commit -m "feat(api): GET /api/ops/my-tasks returns phase queue for logged-in user"
```

---

## Task 5: API — POST Checklist Toggle

**Files:**
- Create: `app/api/ops/my-tasks/[enrollmentId]/checklist/route.ts`

- [ ] **Step 1: Create the POST route**

```typescript
// app/api/ops/my-tasks/[enrollmentId]/checklist/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPhaseChecklist } from "@/lib/ops/phase-checklists";
import { z } from "zod";

const bodySchema = z.object({
  phaseKey: z.string().min(1),
  itemKey: z.string().min(1),
  completed: z.boolean(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { enrollmentId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userRole = (session.user as any).role;
  const userId = (session.user as any).id;
  if (!["ADMIN", "OPERATIONAL"].includes(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { phaseKey, itemKey, completed } = parsed.data;
  const { enrollmentId } = params;

  // Validate item exists in the template
  const template = getPhaseChecklist(phaseKey);
  const item = template.find((i) => i.key === itemKey);
  if (!item) {
    return NextResponse.json({ error: "Unknown checklist item" }, { status: 400 });
  }

  // Prevent manual toggling of auto-complete items
  if (item.autoComplete) {
    return NextResponse.json({ error: "This item is managed automatically" }, { status: 400 });
  }

  const progress = await prisma.phaseChecklistProgress.upsert({
    where: { enrollmentId_phaseKey_itemKey: { enrollmentId, phaseKey, itemKey } },
    create: {
      enrollmentId,
      phaseKey,
      itemKey,
      completedAt: completed ? new Date() : null,
      completedById: completed ? userId : null,
    },
    update: {
      completedAt: completed ? new Date() : null,
      completedById: completed ? userId : null,
    },
  });

  return NextResponse.json({ progress });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/ops/my-tasks/[enrollmentId]/checklist/route.ts"
git commit -m "feat(api): POST checklist toggle for ops my-tasks"
```

---

## Task 6: API — Coordinator Phase Assignment

**Files:**
- Create: `app/api/ops/coordinator/phases/[userId]/route.ts`

- [ ] **Step 1: Create the PATCH route**

```typescript
// app/api/ops/coordinator/phases/[userId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const bodySchema = z.object({
  assignedPhases: z.array(z.string()),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callerRole = (session.user as any).role;
  if (callerRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: params.userId },
    data: { assignedPhases: parsed.data.assignedPhases },
    select: { id: true, name: true, assignedPhases: true },
  });

  return NextResponse.json({ user: updated });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/ops/coordinator/phases/[userId]/route.ts"
git commit -m "feat(api): PATCH coordinator phase assignment per user"
```

---

## Task 7: MyTasksClient Component

**Files:**
- Create: `app/ops/my-tasks/MyTasksClient.tsx`

- [ ] **Step 1: Create the client component**

```typescript
// app/ops/my-tasks/MyTasksClient.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, PauseCircle, CheckSquare, Square,
  ArrowRight, MessageCircle, FileText, Video, FileCheck,
  Loader2, ChevronRight,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChecklistItemData {
  key: string;
  label: string;
  type: string;
  autoComplete: boolean;
  requiresAll: boolean;
  completedAt: string | null;
}

interface EnrollmentData {
  enrollmentId: string;
  studentName: string;
  programType: string;
  phaseKey: string;
  phaseLabel: string;
  assigneeName: string | null;
  startDate: string;
  sessionCount: number;
  daysSinceLastSession: number | null;
  checklistProgress: {
    completed: number;
    total: number;
    items: ChecklistItemData[];
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function urgencyColor(e: EnrollmentData) {
  if (e.daysSinceLastSession !== null && e.daysSinceLastSession >= 14) return "red";
  if (e.daysSinceLastSession !== null && e.daysSinceLastSession >= 7) return "amber";
  return "green";
}

const typeIcon: Record<string, React.ElementType> = {
  whatsapp: MessageCircle,
  form: FileText,
  session: Video,
  doc: FileCheck,
  advance: ChevronRight,
};

const typeBadge: Record<string, string> = {
  whatsapp: "bg-green-100 text-green-700",
  form: "bg-amber-100 text-amber-700",
  session: "bg-blue-100 text-blue-700",
  doc: "bg-purple-100 text-purple-700",
  advance: "bg-gray-100 text-gray-700",
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useMyTasks() {
  return useQuery<{ enrollments: EnrollmentData[] }>({
    queryKey: ["my-tasks"],
    queryFn: () => fetch("/api/ops/my-tasks").then((r) => r.json()),
  });
}

function useToggleItem(enrollmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phaseKey, itemKey, completed }: { phaseKey: string; itemKey: string; completed: boolean }) =>
      fetch(`/api/ops/my-tasks/${enrollmentId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phaseKey, itemKey, completed }),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-tasks"] }),
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StudentCard({ enrollment, isActive, onClick }: {
  enrollment: EnrollmentData;
  isActive: boolean;
  onClick: () => void;
}) {
  const { completed, total } = enrollment.checklistProgress;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const color = urgencyColor(enrollment);

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${
        isActive ? "border-brand-verde shadow-md" : "border-gray-100 hover:border-brand-verde/40 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center gap-3 p-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
          color === "red" ? "bg-red-100 text-red-700" :
          color === "amber" ? "bg-amber-100 text-amber-700" :
          "bg-brand-creme text-brand-verde"
        }`}>
          {initials(enrollment.studentName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 truncate">{enrollment.studentName}</span>
            {color === "red" && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                <AlertTriangle className="h-2.5 w-2.5" /> {enrollment.daysSinceLastSession}d
              </span>
            )}
            {color === "amber" && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                <PauseCircle className="h-2.5 w-2.5" /> {enrollment.daysSinceLastSession}d
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400">{enrollment.phaseLabel} · {enrollment.sessionCount} sessão{enrollment.sessionCount !== 1 ? "ões" : ""}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-xs font-bold ${pct === 100 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
            {completed}/{total}
          </p>
        </div>
      </div>
      <div className="mx-3 mb-2.5">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400"}`}
            style={{ width: `${Math.max(pct, pct > 0 ? 6 : 0)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function ChecklistPanel({ enrollment }: { enrollment: EnrollmentData }) {
  const toggle = useToggleItem(enrollment.enrollmentId);
  const items = enrollment.checklistProgress.items;
  const allPreviousDone = (idx: number) =>
    items.slice(0, idx).every((i) => i.completedAt !== null);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-50 flex items-center gap-3">
        <div className="w-11 h-11 bg-brand-creme rounded-xl flex items-center justify-center text-sm font-bold text-brand-verde flex-shrink-0">
          {initials(enrollment.studentName)}
        </div>
        <div className="flex-1">
          <p className="font-display font-bold text-gray-900 text-lg">{enrollment.studentName}</p>
          <p className="text-xs text-gray-400">{enrollment.phaseLabel} · {enrollment.programType}</p>
        </div>
        <a
          href={`/ops/customers`}
          className="flex items-center gap-1 text-xs font-semibold text-brand-verde hover:text-brand-tangerina transition-colors"
        >
          Ver Perfil <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Checklist */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Checklist da Fase
          </p>
          <p className="text-xs font-bold text-gray-500">
            {enrollment.checklistProgress.completed} de {enrollment.checklistProgress.total} concluídas
          </p>
        </div>

        <div className="space-y-1">
          {items.map((item, idx) => {
            const done = item.completedAt !== null;
            const locked = item.requiresAll && !allPreviousDone(idx);
            const TypeIcon = typeIcon[item.type] ?? Square;

            return (
              <div
                key={item.key}
                className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors ${
                  locked ? "opacity-40" : "hover:bg-gray-50"
                }`}
              >
                {/* Checkbox */}
                {item.autoComplete ? (
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    done ? "bg-brand-verde" : "bg-gray-100"
                  }`}>
                    {done && <span className="text-white text-[11px] font-bold">✓</span>}
                  </div>
                ) : (
                  <button
                    disabled={locked || toggle.isPending}
                    onClick={() => toggle.mutate({ phaseKey: enrollment.phaseKey, itemKey: item.key, completed: !done })}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                      done ? "bg-brand-verde border-brand-verde" : "border-gray-300 hover:border-brand-verde"
                    } disabled:cursor-not-allowed`}
                  >
                    {done && <span className="text-white text-[11px] font-bold">✓</span>}
                  </button>
                )}

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${done ? "line-through text-gray-400" : "text-gray-800 font-medium"}`}>
                    {item.label}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeBadge[item.type] ?? "bg-gray-100 text-gray-600"}`}>
                      <TypeIcon className="h-2.5 w-2.5" />
                      {item.type === "whatsapp" ? "WhatsApp" :
                       item.type === "form" ? "Formulário" :
                       item.type === "session" ? "Sessão" :
                       item.type === "doc" ? "Documento" : "Avanço"}
                    </span>
                    {done && item.completedAt && (
                      <span className="text-[10px] text-gray-400">
                        {new Date(item.completedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </span>
                    )}
                    {item.autoComplete && !done && (
                      <span className="text-[10px] text-gray-400 italic">automático</span>
                    )}
                    {locked && (
                      <span className="text-[10px] text-gray-400">aguardando anteriores</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-5">
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
          <div className="flex-1">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-verde to-emerald-500 rounded-full transition-all"
                style={{ width: `${enrollment.checklistProgress.total > 0 ? Math.round((enrollment.checklistProgress.completed / enrollment.checklistProgress.total) * 100) : 0}%` }}
              />
            </div>
          </div>
          <p className="text-sm font-bold text-brand-verde flex-shrink-0">
            {enrollment.checklistProgress.total > 0
              ? Math.round((enrollment.checklistProgress.completed / enrollment.checklistProgress.total) * 100)
              : 0}%
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MyTasksClient() {
  const { data, isLoading } = useMyTasks();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const enrollments = data?.enrollments ?? [];
  const selected = enrollments.find((e) => e.enrollmentId === selectedId) ?? enrollments[0] ?? null;

  const urgent = enrollments.filter((e) => (e.daysSinceLastSession ?? 0) >= 14).length;
  const incomplete = enrollments.filter((e) => e.checklistProgress.completed < e.checklistProgress.total).length;
  const onTrack = enrollments.length - incomplete;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-verde" />
      </div>
    );
  }

  return (
    <div>
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Alunos na Fase", value: enrollments.length, color: "text-brand-verde" },
          { label: "Incompletos", value: incomplete, color: "text-amber-600" },
          { label: "Precisam Atenção", value: urgent, color: "text-red-600" },
          { label: "Em Dia", value: onTrack, color: "text-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className={`text-2xl font-display font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {enrollments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
          <CheckSquare className="h-12 w-12 text-gray-200 mx-auto mb-4" />
          <p className="font-display font-semibold text-gray-500">Nenhum aluno na sua fase</p>
          <p className="text-sm text-gray-400 mt-1">O coordenador precisa atribuir fases ao seu perfil.</p>
        </div>
      ) : (
        <div className="flex gap-5">
          {/* Queue */}
          <div className="w-80 flex-shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
              Fila de Alunos · ordenado por prioridade
            </p>
            <div className="space-y-2">
              {enrollments.map((e) => (
                <StudentCard
                  key={e.enrollmentId}
                  enrollment={e}
                  isActive={selected?.enrollmentId === e.enrollmentId}
                  onClick={() => setSelectedId(e.enrollmentId)}
                />
              ))}
            </div>
          </div>

          {/* Detail */}
          <div className="flex-1">
            {selected ? (
              <ChecklistPanel enrollment={selected} />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
                <p className="text-sm text-gray-400">Selecione um aluno para ver o checklist</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/ops/my-tasks/MyTasksClient.tsx
git commit -m "feat(ops): MyTasksClient two-panel queue + checklist component"
```

---

## Task 8: Page /ops/my-tasks

**Files:**
- Create: `app/ops/my-tasks/page.tsx`

- [ ] **Step 1: Create the page**

The ops layout already wraps all `/ops/*` pages with `OpsSidebar` and React Query provider. Check `app/ops/layout.tsx` to confirm it wraps children with a QueryClientProvider (or check how `FormsSection` uses React Query — it uses `useQueryClient` from `@tanstack/react-query`, so the provider must exist in the layout chain).

If the ops layout does NOT have a QueryClientProvider, add one now (see sub-step below). If it does, skip to creating the page.

**Check:**

```bash
grep -r "QueryClient" app/ops/
```

If no QueryClientProvider found in `app/ops/layout.tsx`, add a `OpsQueryProvider` wrapper — create `app/ops/OpsQueryProvider.tsx`:

```typescript
// app/ops/OpsQueryProvider.tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function OpsQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

Then in `app/ops/layout.tsx`, wrap the `{children}` with `<OpsQueryProvider>`:

```typescript
// In app/ops/layout.tsx — wrap children
import { OpsQueryProvider } from "./OpsQueryProvider";
// ...
<OpsQueryProvider>{children}</OpsQueryProvider>
```

**Now create the page:**

```typescript
// app/ops/my-tasks/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CheckSquare } from "lucide-react";
import { MyTasksClient } from "./MyTasksClient";

export const dynamic = "force-dynamic";

export default async function MyTasksPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/ops/login");

  const userRole = (session.user as any).role;
  if (!["ADMIN", "OPERATIONAL"].includes(userRole)) redirect("/ops");

  const userName = (session.user as any).name?.split(" ")[0] || "User";

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <CheckSquare className="h-7 w-7 text-brand-verde" />
          <h1 className="text-3xl font-display font-bold text-brand-verde tracking-tight">
            Minhas Tarefas
          </h1>
        </div>
        <p className="text-gray-500 text-sm">
          Alunos sob sua responsabilidade · {userName}
        </p>
      </div>

      <MyTasksClient />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Test in browser**

Start dev: `npm run dev`
Visit `http://localhost:3000/ops/my-tasks` as an ops or admin user.
Expected: page loads, stats bar shows 0s, empty state with message "Nenhum aluno na sua fase".

- [ ] **Step 4: Commit**

```bash
git add app/ops/my-tasks/page.tsx
git add app/ops/OpsQueryProvider.tsx  # only if created
git add app/ops/layout.tsx            # only if modified
git commit -m "feat(ops): add /ops/my-tasks page with server auth guard"
```

---

## Task 9: Sidebar Update

**Files:**
- Modify: `components/ops/ops-sidebar.tsx`

- [ ] **Step 1: Add CheckSquare import and "Minhas Tarefas" nav item**

In `components/ops/ops-sidebar.tsx`, add `CheckSquare` to the lucide import on line 8:

```typescript
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  KanbanSquare,
  LogOut,
  CalendarCheck,
  LayoutList,
  ClipboardList,
  CheckSquare,
} from "lucide-react";
```

In the `navItems` array (starting at line 33), add the "Minhas Tarefas" entry after "Ações do Dia":

```typescript
  const navItems: NavItem[] = [
    { href: "/ops", label: "Dashboard", icon: LayoutDashboard },
    { href: "/ops/daily", label: "Ações do Dia", icon: CalendarCheck },
    { href: "/ops/my-tasks", label: "Minhas Tarefas", icon: CheckSquare },
    { href: "/ops/customers", label: "Clientes", icon: Users },
    { href: "/ops/enroll", label: "Matricular", icon: GraduationCap },
    { href: "/ops/pipeline", label: "Pipeline", icon: KanbanSquare },
    { href: "/dashboard/forms", label: "Formulários", icon: ClipboardList },
    ...(userRole === "ADMIN"
      ? [{ href: "/ops/coordinator", label: "Coordenador", icon: LayoutList }]
      : []),
  ];
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Test in browser**

Visit `http://localhost:3000/ops` — confirm "Minhas Tarefas" appears in sidebar with CheckSquare icon, active state highlights when on `/ops/my-tasks`.

- [ ] **Step 4: Commit**

```bash
git add components/ops/ops-sidebar.tsx
git commit -m "feat(ops): add Minhas Tarefas to ops sidebar"
```

---

## Task 10: Coordinator Phase Assignment UI

**Files:**
- Create: `app/ops/coordinator/PhaseAssignment.tsx`
- Modify: `app/ops/coordinator/page.tsx`

- [ ] **Step 1: Create PhaseAssignment client component**

```typescript
// app/ops/coordinator/PhaseAssignment.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

interface OpsUser {
  id: string;
  name: string | null;
  role: string;
  assignedPhases: string[];
}

interface Phase {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
}

function useOpsUsers() {
  return useQuery<{ users: OpsUser[] }>({
    queryKey: ["coordinator-users"],
    queryFn: () => fetch("/api/ops/users?roles=ADMIN,OPERATIONAL").then((r) => r.json()),
  });
}

function usePhases() {
  return useQuery<{ phases: Phase[] }>({
    queryKey: ["all-phases"],
    queryFn: () => fetch("/api/ops/phases").then((r) => r.json()),
  });
}

function useUpdatePhases(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignedPhases: string[]) =>
      fetch(`/api/ops/coordinator/phases/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedPhases }),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coordinator-users"] }),
  });
}

function UserPhaseRow({ user, phases }: { user: OpsUser; phases: Phase[] }) {
  const [localPhases, setLocalPhases] = useState(user.assignedPhases);
  const update = useUpdatePhases(user.id);

  function toggle(phaseKey: string) {
    const next = localPhases.includes(phaseKey)
      ? localPhases.filter((k) => k !== phaseKey)
      : [...localPhases, phaseKey];
    setLocalPhases(next);
    update.mutate(next);
  }

  return (
    <div className="flex items-start gap-4 p-4 border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 rounded-full bg-brand-tangerina/20 flex items-center justify-center text-brand-tangerina text-xs font-bold flex-shrink-0">
        {(user.name ?? "?").charAt(0).toUpperCase()}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-900">{user.name ?? "Sem nome"}</p>
        <p className="text-xs text-gray-400 mb-2">{user.role}</p>
        <div className="flex flex-wrap gap-2">
          {phases.map((phase) => {
            const assigned = localPhases.includes(phase.key);
            return (
              <button
                key={phase.key}
                onClick={() => toggle(phase.key)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                  assigned
                    ? "bg-brand-verde text-white border-brand-verde"
                    : "bg-white text-gray-500 border-gray-200 hover:border-brand-verde"
                }`}
              >
                {phase.label}
              </button>
            );
          })}
        </div>
      </div>
      {update.isPending && <Loader2 className="h-4 w-4 animate-spin text-brand-verde flex-shrink-0 mt-1" />}
    </div>
  );
}

export function PhaseAssignment() {
  const { data: usersData, isLoading: loadingUsers } = useOpsUsers();
  const { data: phasesData, isLoading: loadingPhases } = usePhases();

  if (loadingUsers || loadingPhases) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-brand-verde" />
      </div>
    );
  }

  const users = usersData?.users ?? [];
  const phases = (phasesData?.phases ?? []).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50">
        <h2 className="text-sm font-display font-semibold text-gray-500 uppercase tracking-wide">
          Atribuição de Fases por Membro
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Clique nas fases para atribuir ou remover responsabilidade
        </p>
      </div>
      <div>
        {users.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Nenhum usuário operacional encontrado</p>
        ) : (
          users.map((user) => (
            <UserPhaseRow key={user.id} user={user} phases={phases} />
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add API routes needed by PhaseAssignment**

The component calls:
- `GET /api/ops/users?roles=ADMIN,OPERATIONAL` — check if this route exists.

```bash
ls app/api/ops/users/
```

If it doesn't exist, create `app/api/ops/users/route.ts`:

```typescript
// app/api/ops/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callerRole = (session.user as any).role;
  if (callerRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rolesParam = req.nextUrl.searchParams.get("roles");
  const roles = rolesParam ? rolesParam.split(",") : [];

  const users = await prisma.user.findMany({
    where: {
      active: true,
      ...(roles.length > 0 ? { role: { in: roles as any[] } } : {}),
    },
    select: { id: true, name: true, role: true, assignedPhases: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ users });
}
```

The component also calls `GET /api/ops/phases` — check if it exists:

```bash
ls app/api/ops/phases/
```

If it doesn't exist, create `app/api/ops/phases/route.ts`:

```typescript
// app/api/ops/phases/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const phases = await prisma.mentorshipPhase.findMany({
    select: { id: true, key: true, label: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ phases });
}
```

- [ ] **Step 3: Add PhaseAssignment to coordinator page**

In `app/ops/coordinator/page.tsx`, import and render `PhaseAssignment` alongside the existing content. The current page renders `PhaseDistribution` inside `CoordinatorQueryProvider`. Add `PhaseAssignment` in the same provider:

```typescript
// app/ops/coordinator/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CoordinatorQueryProvider } from "./CoordinatorClient";
import { PhaseDistribution } from "./PhaseDistribution";
import { PhaseAssignment } from "./PhaseAssignment";

export default async function CoordinatorPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/ops/login");

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN") redirect("/ops");

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-display font-bold text-brand-verde mb-6">
        Visão do Coordenador
      </h1>
      <CoordinatorQueryProvider>
        <div className="space-y-6">
          <PhaseAssignment />
          <PhaseDistribution />
        </div>
      </CoordinatorQueryProvider>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Test coordinator phase assignment**

As ADMIN, visit `http://localhost:3000/ops/coordinator`.
Expected: New "Atribuição de Fases" section shows ops users as rows, each with phase chips. Clicking a chip assigns/removes the phase and saves immediately (spinner visible briefly).

After assigning phases, visit `http://localhost:3000/ops/my-tasks` as an OPERATIONAL user.
Expected: Student queue shows only students in the user's assigned phases.

- [ ] **Step 6: Commit**

```bash
git add app/ops/coordinator/PhaseAssignment.tsx
git add app/ops/coordinator/page.tsx
git add app/api/ops/users/route.ts     # only if created
git add app/api/ops/phases/route.ts   # only if created
git add "app/api/ops/coordinator/phases/[userId]/route.ts"
git commit -m "feat(coordinator): phase assignment UI and API for ops team members"
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ Page "Minhas Tarefas" with queue + checklist panel (Tasks 7–8)
- ✅ Checklist engine: model + config (Tasks 1–2)
- ✅ Auto-complete sessions (Task 3)
- ✅ Phase assignment via coordinator (Tasks 6 + 10)
- ✅ Sidebar update (Task 9)
- ✅ All APIs (Tasks 4–6)

**Consistency check:**
- `PhaseChecklistProgress` model uses `enrollmentId_phaseKey_itemKey` as the unique compound key — matches all upsert calls throughout.
- `getPhaseChecklist()` and `getSessionItemKey()` are used consistently in Tasks 2, 3, 4, 5.
- All routes require `ADMIN | OPERATIONAL` except the coordinator routes which require `ADMIN` only.
- `autoComplete: true` items are protected from manual toggling in Task 5 POST route.

**Note for team:** After deploy, the coordinator must assign phases to each ops team member via `/ops/coordinator` before "Minhas Tarefas" shows any students. Also fill in `PHASE_CHECKLISTS` in `lib/ops/phase-checklists.ts` for phases beyond `bastao`.
