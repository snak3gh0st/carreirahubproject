'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Contract {
  id: string;
  status: string;
  signerName: string;
  signerEmail: string;
  docusign_env_id: string | null;
  sentAt: string | null;
  signedAt: string | null;
  declinedAt: string | null;
  voidedAt: string | null;
  expiresAt: string | null;
  lastReminderAt: string | null;
  reminderCount: number;
  signedUrl: string | null;
  signedS3Key: string | null;
  signedS3Url: string | null;
  signedS3UrlExpiresAt: string | null;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
  invoice: {
    id: string;
    invoiceNumber: string | null;
    amount: string;
    status: string;
  } | null;
  deal: {
    id: string;
    title: string;
  } | null;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: 'Draft', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  SENT_FOR_SIGNATURE: { label: 'Pending Signature', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  VIEWED: { label: 'Viewed by Customer', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  SIGNED: { label: 'Signed', color: 'text-green-600', bgColor: 'bg-green-100' },
  DECLINED: { label: 'Declined', color: 'text-red-600', bgColor: 'bg-red-100' },
  VOIDED: { label: 'Voided', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  EXPIRED: { label: 'Expired', color: 'text-orange-600', bgColor: 'bg-orange-100' },
};

export default function ContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params.id as string;

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchContract();
  }, [contractId]);

  const fetchContract = async () => {
    try {
      const response = await fetch(`/api/contracts/${contractId}`);
      if (!response.ok) throw new Error('Failed to fetch contract');
      const data = await response.json();
      setContract(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setActionLoading('download');
    setMessage(null);
    try {
      const response = await fetch(`/api/contracts/${contractId}/download`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get download URL');
      }

      // Open download URL in new tab
      window.open(data.downloadUrl, '_blank');
      setMessage({ type: 'success', text: 'Download started' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Download failed' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResend = async () => {
    setActionLoading('resend');
    setMessage(null);
    try {
      const response = await fetch(`/api/contracts/${contractId}/resend`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reminder');
      }

      setMessage({ type: 'success', text: 'Reminder sent successfully' });
      fetchContract(); // Refresh to update reminder count
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to send reminder' });
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error || 'Contract not found'}
        </div>
        <Link href="/dashboard/contracts" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
          Back to Contracts
        </Link>
      </div>
    );
  }

  const status = statusConfig[contract.status] || statusConfig.DRAFT;
  const canResend = ['SENT_FOR_SIGNATURE', 'VIEWED'].includes(contract.status);
  const canDownload = contract.status === 'SIGNED';

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/contracts" className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block">
          &larr; Back to Contracts
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contract Details</h1>
            <p className="text-gray-600">{contract.signerName} - {contract.signerEmail}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${status.bgColor} ${status.color}`}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Actions */}
      <div className="mb-6 flex gap-3">
        {canDownload && (
          <button
            onClick={handleDownload}
            disabled={actionLoading === 'download'}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {actionLoading === 'download' ? 'Getting URL...' : 'Download Signed PDF'}
          </button>
        )}
        {canResend && (
          <button
            onClick={handleResend}
            disabled={actionLoading === 'resend'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {actionLoading === 'resend' ? 'Sending...' : 'Send Reminder'}
          </button>
        )}
      </div>

      {/* Contract Preview - Only for signed contracts */}
      {contract.status === 'SIGNED' && contract.signedS3Url && (
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Contract Preview</h2>
            <a
              href={contract.signedS3Url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              View in New Tab &rarr;
            </a>
          </div>
          <div className="relative w-full">
            <iframe
              src={contract.signedS3Url}
              className="w-full border border-gray-200 rounded-lg"
              style={{ height: '600px', minHeight: '600px' }}
              title="Contract Preview"
              onError={() => {
                setMessage({ type: 'error', text: 'Failed to load PDF preview. Please use the download button or open in new tab.' });
              }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Tip: Use the download button above for the best viewing experience, or click &quot;View in New Tab&quot; to open in a separate window.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contract Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Contract Information</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-gray-500">DocuSign Envelope ID</dt>
              <dd className="text-gray-900 font-mono text-sm">{contract.docusign_env_id || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Sent At</dt>
              <dd className="text-gray-900">{formatDate(contract.sentAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Expires At</dt>
              <dd className="text-gray-900">{formatDate(contract.expiresAt)}</dd>
            </div>
            {contract.signedAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Signed At</dt>
                <dd className="text-green-600 font-medium">{formatDate(contract.signedAt)}</dd>
              </div>
            )}
            {contract.declinedAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Declined At</dt>
                <dd className="text-red-600">{formatDate(contract.declinedAt)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">Reminders Sent</dt>
              <dd className="text-gray-900">{contract.reminderCount}</dd>
            </div>
            {contract.lastReminderAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Last Reminder</dt>
                <dd className="text-gray-900">{formatDate(contract.lastReminderAt)}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Customer Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Customer</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-gray-500">Name</dt>
              <dd className="text-gray-900">{contract.customer.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Email</dt>
              <dd className="text-gray-900">{contract.customer.email}</dd>
            </div>
            {contract.customer.phone && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Phone</dt>
                <dd className="text-gray-900">{contract.customer.phone}</dd>
              </div>
            )}
          </dl>
          <Link
            href={`/dashboard/customers/${contract.customer.id}`}
            className="mt-4 inline-block text-blue-600 hover:text-blue-800 text-sm"
          >
            View Customer Profile &rarr;
          </Link>
        </div>

        {/* Invoice Info */}
        {contract.invoice && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Related Invoice</h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-500">Invoice Number</dt>
                <dd className="text-gray-900">{contract.invoice.invoiceNumber || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Amount</dt>
                <dd className="text-gray-900 font-semibold">{formatCurrency(contract.invoice.amount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd className="text-gray-900">{contract.invoice.status}</dd>
              </div>
            </dl>
            <Link
              href={`/dashboard/invoices/${contract.invoice.id}`}
              className="mt-4 inline-block text-blue-600 hover:text-blue-800 text-sm"
            >
              View Invoice &rarr;
            </Link>
          </div>
        )}

        {/* Deal Info */}
        {contract.deal && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Related Deal</h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-500">Title</dt>
                <dd className="text-gray-900">{contract.deal.title}</dd>
              </div>
            </dl>
            <Link
              href={`/dashboard/deals/${contract.deal.id}`}
              className="mt-4 inline-block text-blue-600 hover:text-blue-800 text-sm"
            >
              View Deal &rarr;
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
