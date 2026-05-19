"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RealtimeTestResetButton({ testId }: { testId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function resetTest() {
    if (loading) return;
    const confirmed = window.confirm(
      "Reset this oral test? The student will need to start a new oral English test."
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/dashboard/tests/realtime/${testId}/reset`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data?.error === "string" ? data.error : "Reset failed");
      }

      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={resetTest}
      disabled={loading}
      className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Resetting..." : "Reset"}
    </button>
  );
}
