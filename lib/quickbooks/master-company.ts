export function getExpectedQuickBooksRealmId(): string | null {
  const realmId =
    process.env.QUICKBOOKS_EXPECTED_REALM?.trim() ||
    process.env.QUICKBOOKS_COMPANY_ID?.trim();
  return realmId ? realmId : null;
}
