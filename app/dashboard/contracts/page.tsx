'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { FileText, Plus, Search } from 'lucide-react';

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
  customer: {
    id: string;
    name: string;
    email: string;
  };
  invoices: {
    id: string;
    invoiceNumber: string | null;
    amount: string;
  }[];
  deal: {
    id: string;
    title: string;
  } | null;
}

const statusConfig: Record<ContractStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  DRAFT: { label: 'Rascunho', variant: 'default' },
  SENT_FOR_SIGNATURE: { label: 'Enviado', variant: 'info' },
  VIEWED: { label: 'Visualizado', variant: 'info' },
  SIGNED: { label: 'Assinado', variant: 'success' },
  DECLINED: { label: 'Recusado', variant: 'error' },
  VOIDED: { label: 'Anulado', variant: 'default' },
  EXPIRED: { label: 'Expirado', variant: 'error' },
};

export default function ContractsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  });
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activeStatus, setActiveStatus] = useState<ContractStatus | ''>('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const status = searchParams.get('status') as ContractStatus | null;
    const search = searchParams.get('search');
    const page = searchParams.get('page');

    if (status) setActiveStatus(status);
    if (search) setSearchTerm(search);

    fetchContracts(status || '', search || '', page ? parseInt(page) : 1);
  }, [searchParams]);

  const fetchContracts = async (status: string, search: string, page: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
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

  const updateFilters = (status: ContractStatus | '', search: string, page: number = 1) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    if (page > 1) params.set('page', page.toString());

    router.push(`/dashboard/contracts?${params.toString()}`);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'MMM dd, yyyy');
  };

  const formatCurrency = (amount: string) => {
    return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const totalContracts = Object.values(counts).reduce((a, b) => a + b, 0);
  const signedCount = counts['SIGNED'] || 0;
  const sentCount = counts['SENT_FOR_SIGNATURE'] || 0;
  const expiredCount = counts['EXPIRED'] || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 md:p-8 max-w-7xl">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-semibold text-gray-900">Contratos</h1>
            <p className="text-gray-600 mt-1">Gerencie contratos DocuSign e acompanhe o status das assinaturas</p>
          </div>
          <Link
            href="/dashboard/contracts/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            <Plus className="h-5 w-5" />
            <span className="hidden sm:inline">Criar Contrato</span>
          </Link>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            label="Total de Contratos"
            value={totalContracts.toString()}
            icon={<FileText className="h-5 w-5" />}
          />
          <StatCard
            label="Assinados"
            value={signedCount.toString()}
            description="Contratos concluídos"
          />
          <StatCard
            label="Aguardando Assinatura"
            value={sentCount.toString()}
            description="Pendentes de assinatura"
          />
          <StatCard
            label="Expirados"
            value={expiredCount.toString()}
            description="Precisam de atenção"
          />
        </div>

        {/* Status filter chips */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-display font-medium text-gray-500 uppercase">Filtrar por Status:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => updateFilters('', searchTerm)}
              className={`px-4 py-2 rounded-lg text-sm font-display font-medium transition-colors ${
                !activeStatus ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Todos ({totalContracts})
            </button>
            {(Object.keys(statusConfig) as ContractStatus[]).map((status) => {
              const config = statusConfig[status];
              const count = counts[status] || 0;
              return (
                <button
                  key={status}
                  onClick={() => updateFilters(status, searchTerm)}
                  className={`px-4 py-2 rounded-lg text-sm font-display font-medium transition-colors ${
                    activeStatus === status
                      ? 'bg-primary-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {config.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Search */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && updateFilters(activeStatus, searchTerm)}
              placeholder="Buscar por nome ou e-mail do cliente..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 bg-error-50 border border-error-200 rounded-lg text-error-700">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            {/* Contracts table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                        Cliente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                        Fatura
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                        Enviado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                        Expira
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                        Lembretes
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {contracts.length === 0 ? (
                      <tr>
                        <td colSpan={7}>
                          <div className="py-12">
                            <EmptyState
                              icon={<FileText className="h-12 w-12" />}
                              title="Nenhum contrato encontrado"
                              description="Tente ajustar os filtros ou crie um novo contrato"
                            />
                          </div>
                        </td>
                      </tr>
                    ) : (
                      contracts.map((contract) => {
                        const config = statusConfig[contract.status];
                        return (
                          <tr key={contract.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-display font-medium text-gray-900">{contract.signerName}</div>
                                <div className="text-xs text-gray-500">{contract.signerEmail}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {contract.invoices && contract.invoices.length > 0 ? (
                                <div>
                                  <Link
                                    href={`/dashboard/invoices/${contract.invoices[0].id}`}
                                    className="text-sm font-display font-medium text-primary-600 hover:text-primary-700"
                                  >
                                    {contract.invoices[0].invoiceNumber || contract.invoices[0].id.slice(0, 8)}
                                  </Link>
                                  {contract.invoices.length > 1 && (
                                    <span className="ml-1 text-xs text-gray-500">
                                      +{contract.invoices.length - 1} parcela(s)
                                    </span>
                                  )}
                                  <div className="text-xs text-gray-500 tabular-nums font-display font-semibold">
                                    {formatCurrency(
                                      contract.invoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0).toString()
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge variant={config.variant}>
                                {config.label}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-display text-gray-900 tabular-nums">
                              {formatDate(contract.sentAt)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-display text-gray-900 tabular-nums">
                              {formatDate(contract.expiresAt)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-display text-gray-900 tabular-nums">
                              {contract.reminderCount}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <Link
                                href={`/dashboard/contracts/${contract.id}`}
                                className="text-primary-600 hover:text-primary-700 font-medium"
                              >
                                Ver
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-between items-center">
                <div className="text-sm text-gray-700">
                  Exibindo <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> a{' '}
                  <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> de{' '}
                  <span className="font-medium">{pagination.total}</span> contratos
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateFilters(activeStatus, searchTerm, pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => updateFilters(activeStatus, searchTerm, pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
