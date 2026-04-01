"use client";

import * as Dialog from "@radix-ui/react-dialog";

export interface PendingMove {
  enrollmentId: string;
  studentName: string;
  toPhaseId: string;
  toPhaseLabel: string;
}

interface AdvanceDialogProps {
  pending: PendingMove | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function AdvanceDialog({ pending, onConfirm, onCancel, isLoading }: AdvanceDialogProps) {
  return (
    <Dialog.Root open={pending !== null} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm z-50">
          <Dialog.Title className="text-lg font-display font-bold text-gray-900 mb-2">
            Avançar fase
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-600 mb-6">
            {pending
              ? `Mover ${pending.studentName} para ${pending.toPhaseLabel}?`
              : ""}
          </Dialog.Description>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium bg-brand-verde text-white rounded-lg hover:bg-brand-verde/90 transition-colors disabled:opacity-50"
            >
              {isLoading ? "Avançando..." : "Confirmar"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
