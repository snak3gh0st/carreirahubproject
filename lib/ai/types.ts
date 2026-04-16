import type { UserRole } from '@prisma/client';

export interface ToolContext {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
  };
  conversationId: string;
  requestStartedAt: number; // epoch ms
}

// Sanitized DTOs — no tokens, passwords, or raw PII beyond name/email
export interface SafeInvoiceDto {
  id: string;
  number: string | null;
  customerId: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  status: string;
  dueDate: string | null;
  issuedAt: string | null;
  source: 'hub' | 'quickbooks';
}

export interface SafeCustomerDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  quickbooksId: string | null;
  clintContactId: string | null;
}

export interface SafeStudentDto {
  enrollmentId: string;
  customerId: string;
  name: string;
  email: string;
  programType: string;
  status: string;
  currentPhaseKey: string | null;
  currentPhaseLabel: string | null;
  assignedUserId: string | null;
}

export interface SafeLeadDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  source: string;
  qualificationScore: number | null;
  createdAt: string;
  lastContactAt: string | null;
}

export interface SafeContractDto {
  id: string;
  customerId: string;
  customerName: string;
  status: string;
  docusignEnvelopeId: string | null;
  signedAt: string | null;
  createdAt: string;
}
