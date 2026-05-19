'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  FileText, Plus, Search, CheckCircle2, Clock, Eye, XCircle,
  Ban, AlertTriangle, FileEdit, Send, ArrowRight, TrendingUp,
  Users, ShieldCheck, Timer,
} from 'lucide-react';

type ContractStatus = 'DRAFT' | 'SENT_FOR_SIGNATURE' | 'VIEWED' | 'SIGNED' | 'DECLINED' | 'VOIDED' | 'EXPIRED';

interface Contract {
  id: string;
  status: ContractStatus;
  signerName: string;
  signerEmail: string;
  sentAt: string | null;
  signedAt: string | null;
  expiresAt: string | null;
  reminderCount: number;
  customer: { id: string; name: string; email: string };
  invoices: { id: string; invoiceNumber: string | null; amount: string }[];
  deal: { id: string; title: string } | null;
}

const statusConfig: Record<ContractStatus, {
  label: string;
  icon: typeof CheckCircle2;
  color: string;
  bg: string;
  border: string;
  dot: string;
}> = {
  DRAFT: { label: 'Rascunho', icon: FileEdit, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-400' },
  SENT_FOR_SIGNATURE: { label: 'Enviado', icon: Send, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500' },
  VIEWED: { label: 'Visualizado', icon: Eye, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  SIGNED: { label: 'Assinado', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  DECLINED: { label: 'Recusado', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500' },
  VOIDED: { label: 'Anulado', icon: Ban, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-400' },
  EXPIRED: { label: 'Expirado', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' },
};

const PROGRESS_STEPS: ContractStatus[] = ['SENT_FOR_SIGNATURE', 'VIEWED', 'SIGNED'];

function getProgressPercent(status: ContractStatus): number {
  if (status === 'SIGNED') return 100;
  if (status === 'VIEWED') return 66;
  if (status === 'SENT_FOR_SIGNATURE') return 33;
  return 0;
}

function getUrgency(contract: Contract): 'critical' | 'warning' | null {
  if (!contract.expiresAt || contract.status === 'SIGNED' || contract.status === 'VOIDED' || contract.status === 'EXPIRED' || contract.status === 'DECLINED') return null;
  const days = differenceInDays(new Date(contract.expiresAt), new Date());
  if (days <= 3) return 'critical';
  if (days <= 7) return 'warning';
  return null;
}

export default function ContractsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activeStatus, setActiveStatus] = useState<ContractStatus | ''>('');
  const [activeStatusGroup, setActiveStatusGroup] = useState<'' | 'pending'>('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const status = searchParams.get('status') as ContractStatus | null;
    const statusGroup = searchParams.get('statusGroup') === 'pending' ? 'pending' : '';
    const search = searchParams.get('search');
    const page = searchParams.get('page');
    setActiveStatus(status || '');
    setActiveStatusGroup(statusGroup);
    if (search) setSearchTerm(search);
    fetchContracts(status || '', search || '', page ? parseInt(page) : 1, statusGroup);
  }, [searchParams]);

  const fetchContracts = async (status: string, search: string, page: number, statusGroup: '' | 'pending' = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (statusGroup) params.set('statusGroup', statusGroup);
      if (search) params.set('search', search);
      params.set('page', page.toString());
      const response = await fetch(`/api/contracts?${params}`);
      if (!response.ok) throw new Error('Failed to fetch contracts');
      const data = await response.json();
      setContracts(data.contracts);
      setPagination(data.pagination);
      setCounts(data.counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const updateFilters = (status: ContractStatus | '', search: string, page: number = 1, statusGroup: '' | 'pending' = '') => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (statusGroup) params.set('statusGroup', statusGroup);
    if (search) params.set('search', search);
    if (page > 1) params.set('page', page.toString());
    router.push(`/dashboard/contracts?${params.toString()}`);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'dd MMM yyyy', { locale: ptBR });
  };

  const formatCurrency = (amount: string) =>
    `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totalContracts = Object.values(counts).reduce((a, b) => a + b, 0);
  const signedCount = counts['SIGNED'] || 0;
  const pendingCount = (counts['SENT_FOR_SIGNATURE'] || 0) + (counts['VIEWED'] || 0);
  const expiredCount = counts['EXPIRED'] || 0;
  const signRate = totalContracts > 0 ? Math.round((signedCount / totalContracts) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="container mx-auto p-6 md:p-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-semibold text-gray-900 tracking-tight">Contratos</h1>
            <p className="text-gray-500 mt-1">Gerencie contratos DocuSign e acompanhe assinaturas</p>
          </div>
          <Link
            href="/dashboard/contracts/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-medium rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all shadow-md shadow-primary-600/20 hover:shadow-lg hover:shadow-primary-600/30 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            <Plus className="h-5 w-5" />
            <span className="hidden sm:inline">Criar Contrato</span>
          </Link>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <button
            type="button"
            onClick={() => updateFilters('', searchTerm)}
            className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-shadow text-left ${
              !activeStatus && !activeStatusGroup ? 'border-green-300 ring-2 ring-green-100' : 'border-gray-100'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-gray-100 rounded-xl">
                <FileText className="h-5 w-5 text-gray-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Total</span>
            </div>
            <p className="text-3xl font-display font-bold text-gray-900 tabular-nums">{totalContracts}</p>
            <p className="text-xs text-gray-400 mt-1">contratos criados</p>
          </button>

          <button
            type="button"
            onClick={() => updateFilters('SIGNED', searchTerm)}
            className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-shadow text-left ${
              activeStatus === 'SIGNED' ? 'border-green-300 ring-2 ring-green-100' : 'border-emerald-100'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-emerald-50 rounded-xl">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Assinados</span>
            </div>
            <p className="text-3xl font-display font-bold text-emerald-700 tabular-nums">{signedCount}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <p className="text-xs text-emerald-600 font-medium">{signRate}% taxa de assinatura</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => updateFilters('', searchTerm, 1, 'pending')}
            className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-shadow text-left ${
              activeStatusGroup === 'pending' ? 'border-green-300 ring-2 ring-green-100' : 'border-blue-100'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-blue-50 rounded-xl">
                <Timer className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Pendentes</span>
            </div>
            <p className="text-3xl font-display font-bold text-blue-700 tabular-nums">{pendingCount}</p>
            <p className="text-xs text-gray-400 mt-1">aguardando assinatura</p>
          </button>

          <button
            type="button"
            onClick={() => updateFilters('EXPIRED', searchTerm)}
            className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-shadow text-left ${
              activeStatus === 'EXPIRED' ? 'border-green-300 ring-2 ring-green-100' : 'border-amber-100'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-amber-50 rounded-xl">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Expirados</span>
            </div>
            <p className="text-3xl font-display font-bold text-amber-700 tabular-nums">{expiredCount}</p>
            <p className="text-xs text-gray-400 mt-1">precisam de atenção</p>
          </button>
        </div>

        {/* Filters + Search */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Status pills */}
            <div className="flex flex-wrap gap-1.5 flex-1">
              <button
                onClick={() => updateFilters('', searchTerm)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                  !activeStatus
                    && !activeStatusGroup
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Todos ({totalContracts})
              </button>
              {(Object.keys(statusConfig) as ContractStatus[]).map((status) => {
                const config = statusConfig[status];
                const count = counts[status] || 0;
                const Icon = config.icon;
                return (
                  <button
                    key={status}
                    onClick={() => updateFilters(status, searchTerm)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                      activeStatus === status
                        ? `${config.bg} ${config.color} border ${config.border}`
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {config.label} ({count})
                  </button>
                );
              })}
            </div>
            {/* Search */}
            <div className="relative min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && updateFilters(activeStatus, searchTerm)}
                placeholder="Buscar cliente..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm flex items-center gap-2">
            <XCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-[72px] bg-white border border-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : contracts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
            <div className="inline-flex p-4 bg-gray-50 rounded-2xl mb-4">
              <FileText className="h-10 w-10 text-gray-300" />
            </div>
            <h3 className="text-lg font-display font-semibold text-gray-900 mb-1">Nenhum contrato encontrado</h3>
            <p className="text-sm text-gray-500 mb-6">Ajuste os filtros ou crie um novo contrato</p>
            <Link
              href="/dashboard/contracts/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Criar Contrato
            </Link>
          </div>
        ) : (
          <>
            {/* Contract cards */}
            <div className="space-y-2">
              {contracts.map((contract) => {
                const config = statusConfig[contract.status];
                const Icon = config.icon;
                const urgency = getUrgency(contract);
                const progress = getProgressPercent(contract.status);
                const daysLeft = contract.expiresAt ? differenceInDays(new Date(contract.expiresAt), new Date()) : null;

                return (
                  <Link
                    key={contract.id}
                    href={`/dashboard/contracts/${contract.id}`}
                    className={`group block bg-white rounded-xl border transition-all hover:shadow-md hover:border-gray-200 ${
                      urgency === 'critical' ? 'border-red-200 bg-red-50/30' :
                      urgency === 'warning' ? 'border-amber-200 bg-amber-50/20' :
                      'border-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-4 p-4">
                      {/* Status icon */}
                      <div className={`flex-shrink-0 p-2.5 rounded-xl ${config.bg}`}>
                        <Icon className={`h-5 w-5 ${config.color}`} />
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-display font-semibold text-gray-900 truncate">
                            {contract.signerName}
                          </span>
                          {urgency && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${
                              urgency === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              <AlertTriangle className="h-3 w-3" />
                              {daysLeft != null && daysLeft <= 0 ? 'Expirou' : `${daysLeft}d`}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{contract.signerEmail}</p>
                      </div>

                      {/* Invoice info */}
                      <div className="hidden md:block text-right min-w-[120px]">
                        {contract.invoices.length > 0 ? (
                          <>
                            <p className="text-sm font-display font-semibold text-gray-900 tabular-nums">
                              {formatCurrency(contract.invoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0).toString())}
                            </p>
                            <p className="text-xs text-gray-400">
                              {contract.invoices[0].invoiceNumber || '-'}
                              {contract.invoices.length > 1 && ` +${contract.invoices.length - 1}`}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-gray-400">Sem fatura</p>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="hidden lg:flex flex-col items-center gap-1 min-w-[100px]">
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              contract.status === 'SIGNED' ? 'bg-emerald-500' :
                              contract.status === 'DECLINED' || contract.status === 'EXPIRED' ? 'bg-red-400' :
                              'bg-blue-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className={`text-[11px] font-medium ${config.color}`}>{config.label}</span>
                      </div>

                      {/* Date & reminders */}
                      <div className="hidden sm:block text-right min-w-[90px]">
                        <p className="text-sm text-gray-600 tabular-nums">{formatDate(contract.sentAt)}</p>
                        {contract.reminderCount > 0 && (
                          <p className="text-xs text-gray-400">{contract.reminderCount} lembrete{contract.reminderCount > 1 ? 's' : ''}</p>
                        )}
                      </div>

                      {/* Arrow */}
                      <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="mt-6 flex justify-between items-center">
                <p className="text-sm text-gray-500">
                  <span className="font-medium text-gray-700">{(pagination.page - 1) * pagination.limit + 1}</span>
                  {' '}-{' '}
                  <span className="font-medium text-gray-700">{Math.min(pagination.page * pagination.limit, pagination.total)}</span>
                  {' '}de{' '}
                  <span className="font-medium text-gray-700">{pagination.total}</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateFilters(activeStatus, searchTerm, pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => updateFilters(activeStatus, searchTerm, pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Próximo
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
