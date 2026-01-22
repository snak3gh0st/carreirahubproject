/**
 * Invoice Number Generator
 *
 * Format: CUST-YYYY-MM-001
 * Examples:
 *   - "CAR-2026-01-001" (Carreira USA, January 2026, first invoice)
 *   - "JOHN-2026-01-002" (John Doe, January 2026, second invoice)
 *   - "SMIT-2026-02-001" (Smith LLC, February 2026, first invoice)
 */

export interface InvoiceNumberOptions {
  customerName: string;
  date?: Date;
  sequence: number; // 1-based sequence within the invoice series
}

export interface ParsedInvoiceNumber {
  customerCode: string;
  year: number;
  month: number;
  sequence: number;
}

/**
 * Generate customer code from name
 * Takes first 4 alphanumeric characters, uppercase
 * Falls back to "CUST" if name is empty or has no valid chars
 */
export function generateCustomerCode(name: string): string {
  // Remove non-alphanumeric, take first 4 chars, uppercase
  const code = name
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 4)
    .toUpperCase();

  return code.length >= 3 ? code : 'CUST';
}

/**
 * Generate professional invoice number
 */
export function generateInvoiceNumber(options: InvoiceNumberOptions): string {
  const { customerName, date = new Date(), sequence } = options;

  const customerCode = generateCustomerCode(customerName);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const seq = String(sequence).padStart(3, '0');

  return `${customerCode}-${year}-${month}-${seq}`;
}

/**
 * Parse invoice number back to components
 * Returns null if format is invalid
 */
export function parseInvoiceNumber(invoiceNumber: string): ParsedInvoiceNumber | null {
  // Pattern: XXXX-YYYY-MM-NNN
  const match = invoiceNumber.match(/^([A-Z0-9]{3,4})-(\d{4})-(\d{2})-(\d{3})$/);

  if (!match) return null;

  return {
    customerCode: match[1],
    year: parseInt(match[2], 10),
    month: parseInt(match[3], 10),
    sequence: parseInt(match[4], 10),
  };
}

/**
 * Check if string is a valid professional invoice number format
 */
export function isValidInvoiceNumber(invoiceNumber: string): boolean {
  return parseInvoiceNumber(invoiceNumber) !== null;
}
