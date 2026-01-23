'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

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
  invoice: {
    id: string;
    invoiceNumber: string | null;
    amount: string;
  } | null;
  deal: {
    id: string;
    title: string;
  } | null;
}

const statusConfig: Record<ContractStatus, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: 'Draft', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  SENT_FOR_SIGNATURE: { label: 'Pending', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  VIEWED: { label: 'Viewed', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  SIGNED: { label: 'Signed', color: 'text-green-600', bgColor: 'bg-green-100' },
  DECLINED: { label: 'Declined', color: 'text-red-600', bgColor: 'bg-red-100' },
  VOIDED: { label: 'Voided', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  EXPIRED: { label: 'Expired', color: 'text-orange-600', bgColor: 'bg-orange-100' },
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
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  const totalContracts = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Contracts</h1>
        <p className="text-gray-600">Manage DocuSign contracts and track signature status</p>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => updateFilters('', searchTerm)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !activeStatus ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All ({totalContracts})
        </button>
        {(Object.keys(statusConfig) as ContractStatus[]).map((status) => {
          const config = statusConfig[status];
          const count = counts[status] || 0;
          return (
            <button
              key={status}
              onClick={() => updateFilters(status, searchTerm)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeStatus === status
                  ? 'bg-blue-600 text-white'
                  : `${config.bgColor} ${config.color} hover:opacity-80`
              }`}
            >
              {config.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by customer name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && updateFilters(activeStatus, searchTerm)}
          className="w-full max-w-md px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
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
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoice
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expires
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reminders
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {contracts.map((contract) => {
                    const config = statusConfig[contract.status];
                    return (
                      <tr key={contract.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="font-medium text-gray-900">{contract.signerName}</div>
                            <div className="text-sm text-gray-500">{contract.signerEmail}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {contract.invoice ? (
                            <Link
                              href={`/dashboard/invoices/${contract.invoice.id}`}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              {contract.invoice.invoiceNumber || contract.invoice.id.slice(0, 8)}
                              <div className="text-sm text-gray-500">
                                {formatCurrency(contract.invoice.amount)}
                              </div>
                            </Link>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
                            {config.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(contract.sentAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(contract.expiresAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {contract.reminderCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={`/dashboard/contracts/${contract.id}`}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Empty state */}
            {contracts.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No contracts found
              </div>
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => updateFilters(activeStatus, searchTerm, pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => updateFilters(activeStatus, searchTerm, pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
