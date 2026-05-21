type CustomerIdentityFields = {
  ssn?: unknown;
  cpf?: unknown;
  passport?: unknown;
};

export function normalizeSsnLast4(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const digits = value.replace(/\D/g, "");
  if (!digits) return undefined;
  return digits.slice(-4);
}

export function maskSensitiveIdentification(value: unknown): string | null {
  const last4 = normalizeSsnLast4(value);
  return last4 ? `**** ${last4}` : null;
}

export function sanitizeOperationalCustomerIdentification<T extends object>(
  customer: T,
): Omit<T, "ssn" | "cpf" | "passport"> {
  const { ssn: _ssn, cpf: _cpf, passport: _passport, ...safeCustomer } =
    customer as T & CustomerIdentityFields;
  return safeCustomer;
}
