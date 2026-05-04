"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface EnrollmentCard {
  id: string;
  programType: "PASS" | "ADVANCED";
  status: string;
  startDate: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    qbBalance: string | null;
    invoices: Array<{
      id: string;
      invoiceNumber: string | null;
      amount: string;
      amountPaid: string | null;
      dueDate: string;
      status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "VOID" | "PARTIALLY_PAID" | "REFUNDED" | "PARTIALLY_REFUNDED";
    }>;
  };
  assignedTo: {
    id: string;
    name: string | null;
  };
  transitions: Array<{ createdAt: string }>;
  sessions: Array<{ sessionDate: string }>;
  _count: { sessions: number };
  checklistProgress: Array<{ phaseKey: string; itemKey: string; completedAt: string | null }>;
}

export interface PhaseWithEnrollments {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
  slaDays: number;
  enrollments: EnrollmentCard[];
}

export function usePipelineData() {
  return useQuery<PhaseWithEnrollments[]>({
    queryKey: ["pipeline"],
    queryFn: async () => {
      const res = await fetch("/api/ops/pipeline");
      if (!res.ok) throw new Error("Failed to fetch pipeline data");
      return res.json();
    },
  });
}

interface AdvancePhaseArgs {
  enrollmentId: string;
  toPhaseId: string;
}

export function useAdvancePhase() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, AdvancePhaseArgs, { snapshot: PhaseWithEnrollments[] | undefined }>({
    mutationFn: async ({ enrollmentId, toPhaseId }) => {
      const res = await fetch(`/api/ops/enrollments/${enrollmentId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toPhaseId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Failed to advance phase");
      }
      return res.json();
    },
    onMutate: async ({ enrollmentId, toPhaseId }) => {
      await queryClient.cancelQueries({ queryKey: ["pipeline"] });
      const snapshot = queryClient.getQueryData<PhaseWithEnrollments[]>(["pipeline"]);

      if (snapshot) {
        // Find the enrollment and move it optimistically
        let movingEnrollment: EnrollmentCard | undefined;
        const updated = snapshot.map((phase) => {
          const idx = phase.enrollments.findIndex((e) => e.id === enrollmentId);
          if (idx !== -1) {
            movingEnrollment = phase.enrollments[idx];
            return {
              ...phase,
              enrollments: phase.enrollments.filter((e) => e.id !== enrollmentId),
            };
          }
          return phase;
        });

        if (movingEnrollment) {
          const withMoved = updated.map((phase) => {
            if (phase.id === toPhaseId) {
              return {
                ...phase,
                enrollments: [movingEnrollment!, ...phase.enrollments],
              };
            }
            return phase;
          });
          queryClient.setQueryData(["pipeline"], withMoved);
        }
      }

      return { snapshot };
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(["pipeline"], context.snapshot);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}
