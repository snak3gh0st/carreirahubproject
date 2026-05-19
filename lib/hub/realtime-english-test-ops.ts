export const REALTIME_ENGLISH_TEST_RESET_STATUS = "RESET";
export const REALTIME_ENGLISH_TEST_RESET_MESSAGE =
  "Reset by operations. Student must start a new oral English test.";

export function canResetRealtimeEnglishTestStatus(status: string | null | undefined): boolean {
  return status === "IN_PROGRESS";
}

export function buildRealtimeEnglishResetUpdateData(now = new Date()) {
  return {
    status: REALTIME_ENGLISH_TEST_RESET_STATUS,
    failedAt: now,
    errorMessage: REALTIME_ENGLISH_TEST_RESET_MESSAGE,
  };
}
