'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  FileText, CheckCircle2, Clock, Eye, XCircle, Ban, AlertTriangle,
  Send, FileEdit, Download, RefreshCw, User, Mail, Phone, Hash,
  Calendar, Shield, ArrowLeft, ExternalLink, Bell, CreditCard,
} from 'lucide-react';

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
  customer: { id: string; name: string; email: string; phone: string | null };
  invoices: { id: string; invoiceNumber: string | null; amount: string; status: string }[];
  deal: { id: string; title: string } | null;
}

const statusConfig: Record<string, {
  label: string;
  icon: typeof CheckCircle2;
  color: string;
  bg: string;
  border: string;
  textColor: string;
}> = {
  DRAFT: { label: 'Rascunho', icon: FileEdit, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200', textColor: 'text-gray-700' },
  SENT_FOR_SIGNATURE: { label: 'Aguardando Assinatura', icon: Send, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', textColor: 'text-blue-700' },
  VIEWED: { label: 'Visualizado pelo Cliente', icon: Eye, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', textColor: 'text-indigo-700' },
  SIGNED: { label: 'Contrato Assinado', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', textColor: 'text-emerald-700' },
  DECLINED: { label: 'Recusado pelo Cliente', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', textColor: 'text-red-700' },
  VOIDED: { label: 'Contrato Anulado', icon: Ban, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200', textColor: 'text-gray-600' },
  EXPIRED: { label: 'Contrato Expirado', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', textColor: 'text-amber-700' },
};

interface TimelineStep {
  label: string;
  icon: typeof CheckCircle2;
  date: string | null;
  completed: boolean;
  active: boolean;
  failed?: boolean;
}

function buildTimeline(contract: Contract): TimelineStep[] {
  const isFinalNegative = ['DECLINED', 'VOIDED', 'EXPIRED'].includes(contract.status);

  const steps: TimelineStep[] = [
    {
      label: 'Contrato Criado',
      icon: FileText,
      date: contract.sentAt,
      completed: true,
      active: false,
    },
    {
      label: 'Enviado para Assinatura',
      icon: Send,
      date: contract.sentAt,
      completed: !!contract.sentAt,
      active: contract.status === 'SENT_FOR_SIGNATURE',
    },
    {
      label: 'Visualizado pelo Cliente',
      icon: Eye,
      date: contract.status === 'VIEWED' || contract.status === 'SIGNED' ? contract.sentAt : null,
      completed: ['VIEWED', 'SIGNED'].includes(contract.status),
      active: contract.status === 'VIEWED',
    },
    {
      label: isFinalNegative
        ? contract.status === 'DECLINED' ? 'Recusado' : contract.status === 'VOIDED' ? 'Anulado' : 'Expirado'
        : 'Assinado',
      icon: isFinalNegative
        ? contract.status === 'DECLINED' ? XCircle : contract.status === 'VOIDED' ? Ban : AlertTriangle
        : CheckCircle2,
      date: contract.signedAt || contract.declinedAt || contract.voidedAt,
      completed: ['SIGNED', 'DECLINED', 'VOIDED', 'EXPIRED'].includes(contract.status),
      active: ['SIGNED', 'DECLINED', 'VOIDED', 'EXPIRED'].includes(contract.status),
      failed: isFinalNegative,
    },
  ];

  return steps;
}

export default function ContractDetailPage() {
  const params = useParams();
  const contractId = params.id as string;

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { fetchContract(); }, [contractId]);

  const fetchContract = async () => {
    try {
      const response = await fetch(`/api/contracts/${contractId}`);
      if (!response.ok) throw new Error('Failed to fetch contract');
      setContract(await response.json());
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
      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        const data = contentType.includes('application/json')
          ? await response.json()
          : null;
        throw new Error(data?.error || 'Failed to get download URL');
      }

      if (contentType.includes('application/json')) {
        const data = await response.json();
        if (!data?.downloadUrl) {
          throw new Error('No download URL returned');
        }
        window.open(data.downloadUrl, '_blank', 'noopener,noreferrer');
      } else {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      }

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
      const response = await fetch(`/api/contracts/${contractId}/resend`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to resend DocuSign notification');
      setMessage({ type: 'success', text: 'Notificacao do DocuSign reenviada com sucesso' });
      fetchContract();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Falha ao reenviar notificacao do DocuSign' });
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), "dd 'de' MMM yyyy, HH:mm", { locale: ptBR });
  };

  const formatCurrency = (amount: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(amount));

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="animate-pulse space-y-6">
          <div className="h-6 w-32 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-200 rounded-2xl" />
          <div className="grid grid-cols-2 gap-6">
            <div className="h-48 bg-gray-200 rounded-2xl" />
            <div className="h-48 bg-gray-200 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-red-700 flex items-center gap-3">
          <XCircle className="h-5 w-5 flex-shrink-0" />
          {error || 'Contrato não encontrado'}
        </div>
        <Link href="/dashboard/contracts" className="mt-4 inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-700 text-sm font-medium">
          <ArrowLeft className="h-4 w-4" /> Voltar para Contratos
        </Link>
      </div>
    );
  }

  const status = statusConfig[contract.status] || statusConfig.DRAFT;
  const StatusIcon = status.icon;
  const canResend = ['SENT_FOR_SIGNATURE', 'VIEWED'].includes(contract.status);
  const canDownload = contract.status === 'SIGNED';
  const timeline = buildTimeline(contract);
  const daysLeft = contract.expiresAt ? differenceInDays(new Date(contract.expiresAt), new Date()) : null;
  const totalAmount = contract.invoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0);

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="container mx-auto p-6 max-w-5xl">
        {/* Breadcrumb */}
        <Link href="/dashboard/contracts" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar para Contratos
        </Link>

        {/* Hero Header */}
        <div className={`rounded-2xl border ${status.border} ${status.bg} p-6 mb-6`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-white/80 shadow-sm`}>
                <StatusIcon className={`h-7 w-7 ${status.color}`} />
              </div>
              <div>
                <h1 className={`text-xl font-display font-bold ${status.textColor}`}>{status.label}</h1>
                <p className="text-sm text-gray-600 mt-0.5">{contract.signerName} &mdash; {contract.signerEmail}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {daysLeft !== null && !['SIGNED', 'DECLINED', 'VOIDED', 'EXPIRED'].includes(contract.status) && (
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
                  daysLeft <= 3 ? 'bg-red-100 text-red-700' :
                  daysLeft <= 7 ? 'bg-amber-100 text-amber-700' :
                  'bg-white/80 text-gray-700'
                }`}>
                  <Clock className="h-3.5 w-3.5" />
                  {daysLeft <= 0 ? 'Expirou' : `Expira em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}`}
                </div>
              )}
              {canDownload && (
                <button
                  onClick={handleDownload}
                  disabled={actionLoading === 'download'}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  <Download className="h-4 w-4" />
                  {actionLoading === 'download' ? 'Obtendo...' : 'Baixar PDF'}
                </button>
              )}
              {canResend && (
                <button
                  onClick={handleResend}
                  disabled={actionLoading === 'resend'}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 border border-gray-200 disabled:opacity-50 transition-colors shadow-sm"
                >
                  <RefreshCw className={`h-4 w-4 ${actionLoading === 'resend' ? 'animate-spin' : ''}`} />
                  {actionLoading === 'resend' ? 'Enviando...' : 'Reenviar notificacao DocuSign'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-2 text-sm ${
            message.type === 'success' ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' : 'bg-red-50 border border-red-100 text-red-700'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {message.text}
          </div>
        )}

        {/* Timeline */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm">
          <h2 className="text-sm font-display font-semibold text-gray-500 uppercase tracking-wide mb-5">Progresso do Contrato</h2>
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-[18px] top-3 bottom-3 w-0.5 bg-gray-100" />
            <div className="space-y-6">
              {timeline.map((step, i) => {
                const StepIcon = step.icon;
                return (
                  <div key={i} className="relative flex items-start gap-4">
                    <div className={`relative z-10 flex-shrink-0 w-[38px] h-[38px] rounded-xl flex items-center justify-center ${
                      step.failed && step.completed
                        ? 'bg-red-50 border-2 border-red-200'
                        : step.completed
                        ? 'bg-emerald-50 border-2 border-emerald-200'
                        : step.active
                        ? 'bg-blue-50 border-2 border-blue-200 animate-pulse'
                        : 'bg-gray-50 border-2 border-gray-200'
                    }`}>
                      <StepIcon className={`h-4.5 w-4.5 ${
                        step.failed && step.completed ? 'text-red-500' :
                        step.completed ? 'text-emerald-500' :
                        step.active ? 'text-blue-500' :
                        'text-gray-300'
                      }`} />
                    </div>
                    <div className="pt-1.5">
                      <p className={`text-sm font-medium ${
                        step.failed && step.completed ? 'text-red-700' :
                        step.completed ? 'text-gray-900' :
                        'text-gray-400'
                      }`}>
                        {step.label}
                      </p>
                      {step.date && step.completed && (
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(step.date)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* PDF Preview */}
        {contract.status === 'SIGNED' && contract.signedS3Url && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-display font-semibold text-gray-500 uppercase tracking-wide">Documento Assinado</h2>
              <a
                href={contract.signedS3Url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Abrir em Nova Aba <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <iframe
              src={contract.signedS3Url}
              className="w-full border border-gray-100 rounded-xl"
              style={{ height: '500px' }}
              title="Contrato Assinado"
            />
          </div>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Customer */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-display font-semibold text-gray-500 uppercase tracking-wide">Cliente</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
                  <span className="text-sm font-bold text-primary-600">
                    {contract.customer.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-display font-semibold text-gray-900">{contract.customer.name}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Mail className="h-3 w-3" />
                    {contract.customer.email}
                  </div>
                </div>
              </div>
              {contract.customer.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600 pl-[52px]">
                  <Phone className="h-3.5 w-3.5 text-gray-400" />
                  {contract.customer.phone}
                </div>
              )}
            </div>
            <Link
              href={`/dashboard/customers/${contract.customer.id}`}
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Ver Perfil Completo <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* DocuSign Info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-display font-semibold text-gray-500 uppercase tracking-wide">DocuSign</h2>
            </div>
            <dl className="space-y-3">
              <div className="flex items-center justify-between">
                <dt className="text-sm text-gray-500 flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> Envelope ID</dt>
                <dd className="text-sm text-gray-900 font-mono bg-gray-50 px-2 py-0.5 rounded">{contract.docusign_env_id?.slice(0, 12) || '-'}...</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-gray-500 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Enviado em</dt>
                <dd className="text-sm text-gray-900">{formatDate(contract.sentAt)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-gray-500 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Expira em</dt>
                <dd className="text-sm text-gray-900">{formatDate(contract.expiresAt)}</dd>
              </div>
              {contract.signedAt && (
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-gray-500 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Assinado em</dt>
                  <dd className="text-sm text-emerald-700 font-medium">{formatDate(contract.signedAt)}</dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt className="text-sm text-gray-500 flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" /> Lembretes</dt>
                <dd className="text-sm text-gray-900">{contract.reminderCount} enviado{contract.reminderCount !== 1 ? 's' : ''}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Invoices */}
        {contract.invoices.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-display font-semibold text-gray-500 uppercase tracking-wide">
                Fatura{contract.invoices.length > 1 ? 's' : ''} Vinculada{contract.invoices.length > 1 ? 's' : ''}
              </h2>
            </div>
            <div className="divide-y divide-gray-50">
              {contract.invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/dashboard/invoices/${inv.id}`}
                      className="text-sm font-medium text-primary-600 hover:text-primary-700"
                    >
                      {inv.invoiceNumber || inv.id.slice(0, 8)}
                    </Link>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-700' :
                      inv.status === 'VOID' ? 'bg-gray-100 text-gray-500' :
                      inv.status === 'OVERDUE' ? 'bg-red-50 text-red-600' :
                      'bg-blue-50 text-blue-600'
                    }`}>
                      {inv.status}
                    </span>
                  </div>
                  <span className="text-sm font-display font-semibold text-gray-900 tabular-nums">{formatCurrency(inv.amount)}</span>
                </div>
              ))}
            </div>
            {contract.invoices.length > 1 && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between">
                <span className="text-sm font-medium text-gray-500">Total</span>
                <span className="text-sm font-display font-bold text-gray-900 tabular-nums">{formatCurrency(totalAmount.toString())}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
