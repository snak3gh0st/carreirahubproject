import type { UserRole } from '@prisma/client';
import type { AiToolDefinition } from './_base';

// Finance
import { getInvoices } from './finance/get-invoices';
import { getOverdueInvoices } from './finance/get-overdue-invoices';
import { getPaymentsTimeline } from './finance/get-payments-timeline';
import { getQuickBooksReport } from './finance/get-quickbooks-report';
// Students
import { getStudentsByPhase } from './students/get-students-by-phase';
import { getStudentProfile } from './students/get-student-profile';
import { getStudentSessions } from './students/get-student-sessions';
import { getStudentNextActions } from './students/get-student-next-actions';
// Leads
import { getLeadsByStatus } from './leads/get-leads-by-status';
import { getLeadQualification } from './leads/get-lead-qualification';
import { getLeadsBySource } from './leads/get-leads-by-source';
// Contracts
import { getContracts } from './contracts/get-contracts';
import { getDocumentStatus } from './contracts/get-document-status';
// Ops
import { getDailyActionView } from './ops/get-daily-action-view';
import { getCoordinatorOverview } from './ops/get-coordinator-overview';
// Meta
import { listCapabilities } from './meta/list-capabilities';
import { explainDataModel } from './meta/explain-data-model';
import { getCurrentDate } from './meta/get-current-date';
// Utility
import { searchCustomers } from './utility/search-customers';
import { searchStudents } from './utility/search-students';

export const toolRegistry: AiToolDefinition<any, any>[] = [
  getInvoices, getOverdueInvoices, getPaymentsTimeline, getQuickBooksReport,
  getStudentsByPhase, getStudentProfile, getStudentSessions, getStudentNextActions,
  getLeadsByStatus, getLeadQualification, getLeadsBySource,
  getContracts, getDocumentStatus,
  getDailyActionView, getCoordinatorOverview,
  listCapabilities, explainDataModel, getCurrentDate,
  searchCustomers, searchStudents,
];

export function allowedToolsForRole(role: UserRole): AiToolDefinition<any, any>[] {
  return toolRegistry.filter((t) => t.allowedRoles.includes(role));
}
