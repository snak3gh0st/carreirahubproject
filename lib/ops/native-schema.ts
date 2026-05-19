export function isMissingOpsNativeTable(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    (code === "P2021" || code === "P2022") &&
    /ops_student_(profiles|documents|activities)/.test(message)
  );
}

export const OPS_NATIVE_MIGRATION_ERROR =
  "Operational Hub database migration has not been applied yet.";
