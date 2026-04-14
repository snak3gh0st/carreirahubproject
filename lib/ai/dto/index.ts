import type { SafeInvoiceDto, SafeCustomerDto, SafeStudentDto, SafeLeadDto, SafeContractDto } from '../types';

export function truncateJson(value: unknown, maxBytes = 10_000): unknown {
  const str = JSON.stringify(value);
  if (str.length <= maxBytes) return value;
  return { __truncated: true, preview: str.slice(0, maxBytes), originalBytes: str.length };
}

export function toInvoiceSafeDto(inv: {
  id: string; number?: string | null; customerId: string;
  customer?: { name: string; email: string } | null;
  amount: number | unknown; status: string;
  dueDate?: Date | null; issuedAt?: Date | null;
}, source: 'hub' | 'quickbooks' = 'hub'): SafeInvoiceDto {
  return {
    id: inv.id,
    number: inv.number ?? null,
    customerId: inv.customerId,
    customerName: inv.customer?.name ?? '(sem nome)',
    customerEmail: inv.customer?.email ?? '',
    amount: typeof inv.amount === 'number' ? inv.amount : Number(inv.amount ?? 0),
    status: inv.status,
    dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
    issuedAt: inv.issuedAt ? inv.issuedAt.toISOString() : null,
    source,
  };
}

export function toCustomerSafeDto(c: {
  id: string; name: string; email: string; phone?: string | null;
  quickbooks_id?: string | null; pipedrive_id?: number | null;
}): SafeCustomerDto {
  return {
    id: c.id, name: c.name, email: c.email, phone: c.phone ?? null,
    quickbooksId: c.quickbooks_id ?? null, pipedriveId: c.pipedrive_id ?? null,
  };
}

export function toStudentSafeDto(e: {
  id: string; customerId: string; customer: { name: string; email: string };
  programType: string; status: string;
  currentPhase?: { key: string; label: string } | null;
  assignedUserId?: string | null;
}): SafeStudentDto {
  return {
    enrollmentId: e.id,
    customerId: e.customerId,
    name: e.customer.name,
    email: e.customer.email,
    programType: e.programType,
    status: e.status,
    currentPhaseKey: e.currentPhase?.key ?? null,
    currentPhaseLabel: e.currentPhase?.label ?? null,
    assignedUserId: e.assignedUserId ?? null,
  };
}

export function toLeadSafeDto(l: {
  id: string; name: string; email: string; phone?: string | null;
  status: string; source: string;
  qualifications?: { score: number }[] | null;
  createdAt: Date; lastContactedAt?: Date | null;
}): SafeLeadDto {
  return {
    id: l.id, name: l.name, email: l.email, phone: l.phone ?? null,
    status: l.status, source: l.source,
    qualificationScore: l.qualifications?.[0]?.score ?? null,
    createdAt: l.createdAt.toISOString(),
    lastContactAt: l.lastContactedAt ? l.lastContactedAt.toISOString() : null,
  };
}

export function toContractSafeDto(c: {
  id: string; customerId: string; customer: { name: string };
  status: string; docusign_envelope_id?: string | null;
  signedAt?: Date | null; createdAt: Date;
}): SafeContractDto {
  return {
    id: c.id, customerId: c.customerId, customerName: c.customer.name,
    status: c.status, docusignEnvelopeId: c.docusign_envelope_id ?? null,
    signedAt: c.signedAt ? c.signedAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  };
}
