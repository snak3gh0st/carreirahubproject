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
 * Generate customer code from name using initials
 * Takes first character of each word (separated by spaces/hyphens)
 * Falls back to "X" if name is empty or has no valid chars
 *
 * Examples:
 *   - "Philipe Melo" -> "PM"
 *   - "Carreira USA" -> "CU"
 *   - "John" -> "J"
 *   - "Mary Jane Watson" -> "MJW"
 *   - "" -> "X"
 */
export function generateCustomerCode(name: string): string {
  // Split by spaces and hyphens, filter empty strings
  const words = name
    .split(/[\s-]+/)
    .filter(word => word.length > 0);

  if (words.length === 0) return 'X';

  // Take first character of each word, uppercase
  const initials = words
    .map(word => word.charAt(0).toUpperCase())
    .join('');

  return initials || 'X';
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
  // Pattern: X-YYYY-MM-NNN (1-4 char customer code)
  const match = invoiceNumber.match(/^([A-Z0-9]{1,4})-(\d{4})-(\d{2})-(\d{3})$/);

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
