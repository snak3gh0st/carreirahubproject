'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileSignature, Loader2, AlertTriangle, Search, X } from 'lucide-react';
import Link from 'next/link';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  cpf?: string | null;
  passport?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  ssn?: string | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  amount: string;
  status: string;
  description?: string | null;
  dealId?: string | null;
  lineItems?: { description: string; quantity: number; unitPrice: number; amount: number }[] | null;
  installments?: {
    seriesId?: string;
    current?: number;
    total?: number;
    isFirstInstallment?: boolean;
  } | null;
  customer: {
    name: string;
  };
}

interface DocuSignTemplate {
  templateId: string;
  name: string;
  description: string;
  created: string;
  lastModified: string;
  shared: boolean;
}

/** Program/Annex options for the contract template selector */
const PROGRAM_OPTIONS = [
  { value: 'pass_advanced', label: 'PASS Advanced', annex: 'A', description: 'Mentoria Advanced / Mentoria Completa' },
  { value: 'pass', label: 'PASS', annex: 'B', description: 'Mentoria Pass' },
  { value: 'combo', label: 'COMBO', annex: 'C', description: 'Combo Pass / Material + Grupo' },
  { value: 'start', label: 'START', annex: 'D', description: 'Conteúdo Gravado' },
  { value: 'avulso', label: 'Avulso', annex: 'E', description: 'Serviço Individual / Avulso' },
  { value: 'upgrade', label: 'Upgrade', annex: 'F', description: 'Upgrade / Downgrade / Migração' },
  { value: 'new_pass', label: 'New Pass', annex: 'G', description: 'New Pass' },
  { value: 'treinamento', label: 'Treinamento', annex: 'H', description: 'Treinamento' },
] as const;

export default function CreateContractPage() {
  const router = useRouter();
  
  // Form state
  const [customerId, setCustomerId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [program, setProgram] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('30');
  
  // Get customerId from URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const customerIdParam = params.get('customerId');
    if (customerIdParam) {
      setCustomerId(customerIdParam);
    }
  }, []);

  // Data state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [templates, setTemplates] = useState<DocuSignTemplate[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingFields, setMissingFields] = useState<{ field: string; label: string }[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Filter customers based on search
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(customerSearch.toLowerCase())
  );

  // Set search text when customerId is set (from URL param or other source)
  useEffect(() => {
    if (customerId && customers.length > 0 && !customerSearch) {
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        setCustomerSearch(customer.name);
      }
    }
  }, [customerId, customers]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.customer-search-container')) {
        setShowCustomerDropdown(false);
      }
    };

    if (showCustomerDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCustomerDropdown]);

  // Fetch customers and invoices on mount
  useEffect(() => {
    async function fetchData() {
      try {
        setLoadingData(true);
        
        // Fetch customers
        const customersRes = await fetch('/api/customers?limit=10000');
        if (!customersRes.ok) throw new Error('Falha ao buscar clientes');
        const customersData = await customersRes.json();
        setCustomers(customersData.customers || []);
        
        // Fetch invoices
        const invoicesRes = await fetch('/api/invoices?limit=1000');
        if (!invoicesRes.ok) throw new Error('Falha ao buscar faturas');
        const invoicesData = await invoicesRes.json();
        setInvoices(invoicesData.invoices || []);
        
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Falha ao carregar dados');
      } finally {
        setLoadingData(false);
      }
    }
    
    fetchData();
  }, []);

  // Fetch DocuSign templates (used for "Other template" option)
  useEffect(() => {
    async function fetchTemplates() {
      try {
        setLoadingTemplates(true);

        const templatesRes = await fetch('/api/docusign/templates');
        if (!templatesRes.ok) {
          console.warn('Failed to fetch DocuSign templates:', await templatesRes.text());
          return;
        }
        const templatesData = await templatesRes.json();
        setTemplates(templatesData.templates || []);

      } catch (err) {
        console.error('Error fetching templates:', err);
      } finally {
        setLoadingTemplates(false);
      }
    }

    fetchTemplates();
  }, []);

  // When program changes, clear manual template selection
  useEffect(() => {
    if (program && program !== 'other') {
      setTemplateId('');
    }
  }, [program]);

  // Auto-populate signer info and validate customer data when customer is selected
  useEffect(() => {
    if (customerId) {
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        setSignerName(customer.name);
        setSignerEmail(customer.email);

        // Filter invoices for selected customer
        const customerInvoices = invoices.filter(inv =>
          inv.customer && inv.customer.name === customer.name
        );
        setFilteredInvoices(customerInvoices);

        // Check required fields for contract
        const missing: { field: string; label: string }[] = [];
        if (!customer.address || customer.address.trim() === '') {
          missing.push({ field: 'address', label: 'Endereço' });
        }
        if (!customer.email || customer.email.trim() === '') {
          missing.push({ field: 'email', label: 'Email' });
        }
        // At least one identification document (CPF, Passaporte ou SSN)
        const hasId = (customer.cpf && customer.cpf.trim() !== '') ||
                      (customer.passport && customer.passport.trim() !== '') ||
                      (customer.ssn && customer.ssn.trim() !== '');
        if (!hasId) {
          missing.push({ field: 'identification', label: 'Documento de identificação (CPF, Passaporte ou SSN)' });
        }
        setMissingFields(missing);
      }
    } else {
      setFilteredInvoices([]);
      setInvoiceId('');
      setMissingFields([]);
    }
  }, [customerId, customers, invoices]);

  // Auto-populate from invoice if selected
  useEffect(() => {
    if (invoiceId && !customerId) {
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (invoice) {
        // Try to find customer by invoice customer name
        const customer = customers.find(c => c.name === invoice.customer.name);
        if (customer) {
          setCustomerId(customer.id);
          setSignerName(customer.name);
          setSignerEmail(customer.email);
        }
      }
    }
  }, [invoiceId, invoices, customers, customerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerId) {
      setError('Por favor, selecione um cliente');
      return;
    }
    
    if (!program) {
      setError('Por favor, selecione um programa/anexo');
      return;
    }

    if (program === 'other' && !templateId) {
      setError('Por favor, selecione um modelo de contrato');
      return;
    }
    
    if (!signerEmail || !signerName) {
      setError('Nome e email do signatário são obrigatórios');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId,
          invoiceId: invoiceId && invoiceId !== 'none' ? invoiceId : undefined,
          program: program !== 'other' ? program : undefined,
          templateId: program === 'other' ? templateId : undefined,
          signerName,
          signerEmail,
          expiresInDays: parseInt(expiresInDays),
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        if (response.status === 422 && data.missingFields) {
          setMissingFields(data.missingFields);
          throw new Error(data.message || 'Dados do cliente incompletos');
        }
        throw new Error(data.error || 'Falha ao criar contrato');
      }
      
      const data = await response.json();
      
      // Redirect to contract detail page
      router.push(`/dashboard/contracts/${data.contract.id}`);
      
    } catch (err) {
      console.error('Error creating contract:', err);
      setError(err instanceof Error ? err.message : 'Falha ao criar contrato');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/contracts">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Contratos
          </Button>
        </Link>
        
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileSignature className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Criar Contrato</h1>
            <p className="text-sm text-gray-500">Enviar um novo contrato para assinatura via DocuSign</p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Contract Details</CardTitle>
          <CardDescription>
            Fill in the contract information. The contract will be sent to DocuSign for signature.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Customer Selection (searchable) */}
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <div className="relative customer-search-container">
                <div className="relative">
                  <Input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                      if (!e.target.value) {
                        setCustomerId('');
                        setSignerName('');
                        setSignerEmail('');
                      }
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder="Buscar por nome ou email..."
                    className="pl-9"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  {customerId && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerId('');
                        setCustomerSearch('');
                        setSignerName('');
                        setSignerEmail('');
                        setShowCustomerDropdown(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {showCustomerDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    {filteredCustomers.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500">
                        Nenhum cliente encontrado
                      </div>
                    ) : (
                      filteredCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => {
                            setCustomerId(customer.id);
                            setCustomerSearch(customer.name);
                            setShowCustomerDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors ${
                            customerId === customer.id ? 'bg-blue-100' : ''
                          }`}
                        >
                          <div className="text-sm font-medium text-gray-900">
                            {customer.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {customer.email}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Busque e selecione o cliente que irá assinar o contrato
              </p>
            </div>

            {/* Missing Customer Data Warning */}
            {customerId && missingFields.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      Dados do cliente incompletos para gerar contrato
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      Preencha os seguintes dados antes de enviar o contrato:
                    </p>
                    <ul className="list-disc list-inside mt-2 text-sm text-amber-700">
                      {missingFields.map(f => (
                        <li key={f.field}>{f.label}</li>
                      ))}
                    </ul>
                    <Link
                      href={`/dashboard/customers/${customerId}`}
                      className="inline-block mt-3 text-sm font-medium text-amber-900 underline hover:text-amber-700"
                    >
                      Editar dados do cliente →
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Program / Annex Selection */}
            <div className="space-y-2">
              <Label htmlFor="program">Programa / Anexo *</Label>
              <Select value={program} onValueChange={setProgram}>
                <SelectTrigger id="program">
                  <SelectValue placeholder="Selecione o programa" />
                </SelectTrigger>
                <SelectContent>
                  {PROGRAM_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="font-medium">Anexo {opt.annex}</span>
                      <span className="mx-1.5">—</span>
                      <span>{opt.label}</span>
                    </SelectItem>
                  ))}
                  <SelectItem value="other">
                    Outro template (selecionar manualmente)
                  </SelectItem>
                </SelectContent>
              </Select>
              {program && program !== 'other' && (
                <div className="mt-2 p-3 bg-gray-50 rounded-md">
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">
                      Anexo {PROGRAM_OPTIONS.find(o => o.value === program)?.annex}:
                    </span>{' '}
                    {PROGRAM_OPTIONS.find(o => o.value === program)?.description}
                  </p>
                </div>
              )}
            </div>

            {/* Manual Template Selection (only when "Other" is selected) */}
            {program === 'other' && (
              <div className="space-y-2">
                <Label htmlFor="template">DocuSign Template *</Label>
                <Select
                  value={templateId}
                  onValueChange={setTemplateId}
                  disabled={loadingTemplates}
                >
                  <SelectTrigger id="template">
                    <SelectValue placeholder={loadingTemplates ? "Carregando templates..." : "Selecione um template"} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 && !loadingTemplates ? (
                      <SelectItem value="no-templates" disabled>
                        Nenhum template disponível
                      </SelectItem>
                    ) : (
                      templates.map(template => (
                        <SelectItem key={template.templateId} value={template.templateId}>
                          {template.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Selecione um template diretamente do DocuSign
                </p>
              </div>
            )}

            {/* Service / Purchase Selection (links all invoices in the series) */}
            <div className="space-y-2">
              <Label htmlFor="invoice">Serviço Comprado (Opcional)</Label>
              <Select
                value={invoiceId}
                onValueChange={setInvoiceId}
                disabled={!customerId}
              >
                <SelectTrigger id="invoice">
                  <SelectValue placeholder={customerId ? "Selecione o serviço comprado" : "Selecione o cliente primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum serviço</SelectItem>
                  {(() => {
                    // Group invoices by series to show services, not individual invoices
                    // Priority: seriesId → dealId → standalone
                    const seriesMap = new Map<string, Invoice[]>();
                    const standalone: Invoice[] = [];
                    filteredInvoices.forEach(inv => {
                      const seriesId = inv.installments?.seriesId;
                      const groupKey = seriesId ?? (inv.dealId ? `deal:${inv.dealId}` : null);
                      if (groupKey) {
                        if (!seriesMap.has(groupKey)) seriesMap.set(groupKey, []);
                        seriesMap.get(groupKey)!.push(inv);
                      } else {
                        standalone.push(inv);
                      }
                    });

                    const items: React.ReactNode[] = [];

                    // Extract base service name (remove " - Entry Payment", " - Installment X of Y")
                    const getServiceName = (inv: Invoice): string => {
                      const desc = inv.description || inv.lineItems?.[0]?.description || '';
                      return desc
                        .replace(/\s*-\s*(Entry Payment|Installment \d+ of \d+)$/i, '')
                        .trim() || 'Serviço';
                    };

                    // Render series as services
                    seriesMap.forEach((seriesInvoices, seriesId) => {
                      const total = seriesInvoices.reduce((s, i) => s + parseFloat(i.amount), 0);
                      const firstInv = seriesInvoices[0];
                      const serviceName = getServiceName(firstInv);
                      const hasEntry = seriesInvoices.some(i => i.installments?.isFirstInstallment);
                      const installmentCount = hasEntry ? seriesInvoices.length - 1 : seriesInvoices.length;

                      let paymentInfo: string;
                      if (hasEntry && installmentCount > 0) {
                        const entryInv = seriesInvoices.find(i => i.installments?.isFirstInstallment);
                        paymentInfo = `Entrada + ${installmentCount}x parcelas`;
                        if (entryInv) paymentInfo = `Entrada $${parseFloat(entryInv.amount).toFixed(0)} + ${installmentCount}x`;
                      } else if (installmentCount > 1) {
                        paymentInfo = `${installmentCount}x parcelas`;
                      } else {
                        paymentInfo = 'Pagamento único';
                      }

                      items.push(
                        <SelectItem key={seriesId} value={firstInv.id}>
                          {serviceName} — ${total.toFixed(2)} ({paymentInfo})
                        </SelectItem>
                      );
                    });

                    // Render standalone invoices as single services
                    standalone.forEach(inv => {
                      const serviceName = getServiceName(inv);
                      items.push(
                        <SelectItem key={inv.id} value={inv.id}>
                          {serviceName} — ${parseFloat(inv.amount).toFixed(2)}
                        </SelectItem>
                      );
                    });

                    return items;
                  })()}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Selecione o serviço comprado para vincular todas as faturas ao contrato
              </p>
            </div>

            {/* Signer Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="signerName">Signer Name *</Label>
                <Input
                  id="signerName"
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signerEmail">Signer Email *</Label>
                <Input
                  id="signerEmail"
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  placeholder="john@example.com"
                  required
                />
              </div>
            </div>

            {/* Expiration */}
            <div className="space-y-2">
              <Label htmlFor="expiresInDays">Expires In (Days)</Label>
              <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                <SelectTrigger id="expiresInDays">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="15">15 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Contract will expire if not signed within this period
              </p>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                type="submit"
                disabled={loading || !customerId || !program || (program === 'other' && !templateId) || missingFields.some(f => f.field === 'identification')}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Contract...
                  </>
                ) : (
                  <>
                    <FileSignature className="h-4 w-4 mr-2" />
                    Create & Send Contract
                  </>
                )}
              </Button>
              
              <Link href="/dashboard/contracts">
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="mt-6 bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <FileSignature className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">How it works:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Contract is created and sent to DocuSign immediately</li>
                <li>Customer receives email with signing link</li>
                <li>Automatic reminders sent every 3 days if not signed</li>
                <li>Signed contract is stored in S3 and viewable in dashboard</li>
                <li>You'll be notified when customer views or signs</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
