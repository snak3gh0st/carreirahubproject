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
  invoices: {
    id: string;
    invoiceNumber: string | null;
    amount: string;
    status: string;
  }[];
  deal: {
    id: string;
    title: string;
  } | null;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: 'Rascunho', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  SENT_FOR_SIGNATURE: { label: 'Aguardando Assinatura', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  VIEWED: { label: 'Visualizado pelo Cliente', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  SIGNED: { label: 'Assinado', color: 'text-green-600', bgColor: 'bg-green-100' },
  DECLINED: { label: 'Recusado', color: 'text-red-600', bgColor: 'bg-red-100' },
  VOIDED: { label: 'Anulado', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  EXPIRED: { label: 'Expirado', color: 'text-orange-600', bgColor: 'bg-orange-100' },
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
      setMessage({ type: 'success', text: 'Download iniciado' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Falha no download' });
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

      setMessage({ type: 'success', text: 'Lembrete enviado com sucesso' });
      fetchContract(); // Refresh to update reminder count
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Falha ao enviar lembrete' });
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
          {error || 'Contrato não encontrado'}
        </div>
        <Link href="/dashboard/contracts" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
          Voltar para Contratos
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
          &larr; Voltar para Contratos
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Detalhes do Contrato</h1>
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
            {actionLoading === 'download' ? 'Obtendo URL...' : 'Baixar PDF Assinado'}
          </button>
        )}
        {canResend && (
          <button
            onClick={handleResend}
            disabled={actionLoading === 'resend'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {actionLoading === 'resend' ? 'Enviando...' : 'Enviar Lembrete'}
          </button>
        )}
      </div>

      {/* Contract Preview - Only for signed contracts */}
      {contract.status === 'SIGNED' && contract.signedS3Url && (
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Pré-visualização do Contrato</h2>
            <a
              href={contract.signedS3Url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Abrir em Nova Aba &rarr;
            </a>
          </div>
          <div className="relative w-full">
            <iframe
              src={contract.signedS3Url}
              className="w-full border border-gray-200 rounded-lg"
              style={{ height: '600px', minHeight: '600px' }}
              title="Pré-visualização do Contrato"
              onError={() => {
                setMessage({ type: 'error', text: 'Falha ao carregar pré-visualização do PDF. Use o botão de download ou abra em nova aba.' });
              }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Dica: Use o botão de download acima para melhor visualização, ou clique em &quot;Abrir em Nova Aba&quot; para abrir em uma janela separada.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contract Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Informações do Contrato</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-gray-500">DocuSign Envelope ID</dt>
              <dd className="text-gray-900 font-mono text-sm">{contract.docusign_env_id || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Enviado em</dt>
              <dd className="text-gray-900">{formatDate(contract.sentAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Expira em</dt>
              <dd className="text-gray-900">{formatDate(contract.expiresAt)}</dd>
            </div>
            {contract.signedAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Assinado em</dt>
                <dd className="text-green-600 font-medium">{formatDate(contract.signedAt)}</dd>
              </div>
            )}
            {contract.declinedAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Recusado em</dt>
                <dd className="text-red-600">{formatDate(contract.declinedAt)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">Lembretes Enviados</dt>
              <dd className="text-gray-900">{contract.reminderCount}</dd>
            </div>
            {contract.lastReminderAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Último Lembrete</dt>
                <dd className="text-gray-900">{formatDate(contract.lastReminderAt)}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Customer Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Cliente</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-gray-500">Nome</dt>
              <dd className="text-gray-900">{contract.customer.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Email</dt>
              <dd className="text-gray-900">{contract.customer.email}</dd>
            </div>
            {contract.customer.phone && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Telefone</dt>
                <dd className="text-gray-900">{contract.customer.phone}</dd>
              </div>
            )}
          </dl>
          <Link
            href={`/dashboard/customers/${contract.customer.id}`}
            className="mt-4 inline-block text-blue-600 hover:text-blue-800 text-sm"
          >
            Ver Perfil do Cliente &rarr;
          </Link>
        </div>

        {/* Invoices Info */}
        {contract.invoices && contract.invoices.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">
              {contract.invoices.length === 1 ? 'Fatura Relacionada' : `Faturas Relacionadas (${contract.invoices.length})`}
            </h2>
            <div className="space-y-4">
              {contract.invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                  <div>
                    <Link
                      href={`/dashboard/invoices/${inv.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      {inv.invoiceNumber || inv.id.slice(0, 8)}
                    </Link>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                      inv.status === 'PAID' ? 'bg-green-100 text-green-700' :
                      inv.status === 'VOID' ? 'bg-gray-100 text-gray-500' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {inv.status}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(inv.amount)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between">
              <span className="text-sm font-medium text-gray-500">Total</span>
              <span className="text-sm font-bold text-gray-900">
                {formatCurrency(
                  contract.invoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0).toString()
                )}
              </span>
            </div>
          </div>
        )}

        {/* Deal Info */}
        {contract.deal && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Negócio Relacionado</h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-500">Título</dt>
                <dd className="text-gray-900">{contract.deal.title}</dd>
              </div>
            </dl>
            <Link
              href={`/dashboard/deals/${contract.deal.id}`}
              className="mt-4 inline-block text-blue-600 hover:text-blue-800 text-sm"
            >
              Ver Negócio &rarr;
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
