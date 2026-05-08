export const QB_HISTORY_START = {
  year: 2025,
  monthIndex: 0,
  day: 1,
} as const;

export function buildQbHistoryStartDate(): Date {
  return new Date(QB_HISTORY_START.year, QB_HISTORY_START.monthIndex, QB_HISTORY_START.day);
}

export function buildQbReportWindow(options?: { now?: Date }): { now: Date; startDate: Date } {
  return {
    now: options?.now ?? new Date(),
    startDate: buildQbHistoryStartDate(),
  };
}
