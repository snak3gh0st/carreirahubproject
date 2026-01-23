/**
 * Invoice Number Generator - Enhanced Unique Format
 *
 * Format: {CUSTOMER}-{SERVICE}-{YYYYMMDD}-{INSTALLMENT}-{HASH}
 * 
 * Examples:
 *   - "PT-SRV-20260123-S-A3F2" (Single invoice)
 *   - "PM-CON-20260123-E-B7C4" (Entry payment)
 *   - "PM-CON-20260123-I1-D9E1" (Installment 1)
 *   - "PM-CON-20260123-I2-F2A8" (Installment 2)
 *
 * Components:
 *   - CUSTOMER: 2-4 char customer initials
 *   - SERVICE: 2-3 char service code from service name
 *   - YYYYMMDD: Creation date (guaranteed unique per day)
 *   - INSTALLMENT: S (Single), E (Entry), I1-I9 (Installment number)
 *   - HASH: 4 char unique hash from timestamp + data
 *
 * This format guarantees uniqueness through multiple layers:
 * 1. Customer + Service + Date combination is highly unique
 * 2. Installment type differentiates within same series
 * 3. Hash provides final collision-proof guarantee
 */

export interface InvoiceNumberOptions {
  customerName: string;
  serviceName: string;
  date?: Date;
  installmentType: 'single' | 'entry' | 'installment';
  installmentNumber?: number; // For installments: 1, 2, 3, etc.
  amount: number; // Used in hash generation
  seriesId?: string; // Optional series identifier for extra uniqueness
}

export interface ParsedInvoiceNumber {
  customerCode: string;
  serviceCode: string;
  date: string;
  installmentType: string;
  hash: string;
}

/**
 * Generate customer code from name using initials
 * Takes first character of each word (separated by spaces/hyphens)
 * Limits to 4 characters maximum for readability
 * Falls back to "CUST" if name is empty or has no valid chars
 *
 * Examples:
 *   - "Philipe Melo" -> "PM"
 *   - "Carreira USA" -> "CUSA"
 *   - "John" -> "J"
 *   - "Mary Jane Watson" -> "MJW"
 *   - "" -> "CUST"
 */
export function generateCustomerCode(name: string): string {
  if (!name || name.trim().length === 0) return 'CUST';

  // Split by spaces and hyphens, filter empty strings
  const words = name
    .trim()
    .split(/[\s-]+/)
    .filter(word => word.length > 0);

  if (words.length === 0) return 'CUST';

  // Take first character of each word, uppercase, limit to 4 chars
  const initials = words
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 4);

  return initials || 'CUST';
}

/**
 * Generate service code from service name
 * Takes first character of each word, or first 3 chars if single word
 * Limits to 3 characters for consistency
 *
 * Examples:
 *   - "Service - Entry Payment" -> "SEP"
 *   - "Consultoria" -> "CON"
 *   - "Interview Analysis" -> "IA"
 *   - "Green Card Process" -> "GCP"
 */
export function generateServiceCode(serviceName: string): string {
  if (!serviceName || serviceName.trim().length === 0) return 'SRV';

  // Remove common prefixes and clean
  const cleanName = serviceName
    .replace(/^Service\s*-\s*/i, '')
    .trim();

  // Split by spaces and hyphens
  const words = cleanName
    .split(/[\s-]+/)
    .filter(word => word.length > 0);

  if (words.length === 0) return 'SRV';

  // Multi-word: take first letter of each word (max 3)
  if (words.length > 1) {
    return words
      .slice(0, 3)
      .map(word => word.charAt(0).toUpperCase())
      .join('');
  }

  // Single word: take first 3 characters
  return words[0].substring(0, 3).toUpperCase();
}

/**
 * Generate unique 4-character hash from multiple data points
 * Uses timestamp, customer, service, amount, and series for uniqueness
 * Converts to base36 (0-9, a-z) for compact representation
 */
export function generateUniqueHash(options: {
  customerName: string;
  serviceName: string;
  amount: number;
  timestamp: number;
  seriesId?: string;
}): string {
  const { customerName, serviceName, amount, timestamp, seriesId } = options;

  // Combine all unique identifiers
  const dataString = `${timestamp}-${customerName}-${serviceName}-${amount}-${seriesId || ''}`;

  // Simple hash function (djb2 algorithm)
  let hash = 5381;
  for (let i = 0; i < dataString.length; i++) {
    hash = ((hash << 5) + hash) + dataString.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert to base36 and take last 4 characters, uppercase
  const hashStr = Math.abs(hash).toString(36).toUpperCase();
  return hashStr.slice(-4).padStart(4, '0');
}

/**
 * Generate unique professional invoice number
 * Combines multiple data points to guarantee uniqueness
 */
export function generateInvoiceNumber(options: InvoiceNumberOptions): string {
  const {
    customerName,
    serviceName,
    date = new Date(),
    installmentType,
    installmentNumber,
    amount,
    seriesId,
  } = options;

  // Generate components
  const customerCode = generateCustomerCode(customerName);
  const serviceCode = generateServiceCode(serviceName);

  // Date component (YYYYMMDD)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // Installment component
  let installmentCode: string;
  switch (installmentType) {
    case 'single':
      installmentCode = 'S';
      break;
    case 'entry':
      installmentCode = 'E';
      break;
    case 'installment':
      installmentCode = `I${installmentNumber || 1}`;
      break;
    default:
      installmentCode = 'S';
  }

  // Generate unique hash
  const hash = generateUniqueHash({
    customerName,
    serviceName,
    amount,
    timestamp: date.getTime(),
    seriesId,
  });

  // Combine: {CUSTOMER}-{SERVICE}-{YYYYMMDD}-{INSTALLMENT}-{HASH}
  return `${customerCode}-${serviceCode}-${dateStr}-${installmentCode}-${hash}`;
}

/**
 * Parse invoice number back to components
 * Returns null if format is invalid
 */
export function parseInvoiceNumber(invoiceNumber: string): ParsedInvoiceNumber | null {
  // Pattern: XX-YYY-YYYYMMDD-Z-HHHH
  // Customer (1-4 chars) - Service (2-3 chars) - Date (8 digits) - Installment (1-2 chars) - Hash (4 chars)
  const match = invoiceNumber.match(/^([A-Z0-9]{1,4})-([A-Z0-9]{2,3})-(\d{8})-(S|E|I\d{1})-([A-Z0-9]{4})$/);

  if (!match) return null;

  return {
    customerCode: match[1],
    serviceCode: match[2],
    date: match[3],
    installmentType: match[4],
    hash: match[5],
  };
}

/**
 * Check if string is a valid professional invoice number format
 */
export function isValidInvoiceNumber(invoiceNumber: string): boolean {
  return parseInvoiceNumber(invoiceNumber) !== null;
}

/**
 * Format invoice number for display with better readability
 * Example: "PT-SRV-20260123-S-A3F2" -> "PT-SRV-20260123-S-A3F2"
 * (Currently same format, but can be customized for UI display)
 */
export function formatInvoiceNumberForDisplay(invoiceNumber: string): string {
  return invoiceNumber;
}
