export function validateCustomerDeleteConfirmation(
  customerName: string,
  confirmationName: string
): { allowed: boolean; reason?: string } {
  if (confirmationName === customerName) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "Digite exatamente o nome do cliente para confirmar a exclusao.",
  };
}
