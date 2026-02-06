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
import { ArrowLeft, FileSignature, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  amount: string;
  status: string;
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

export default function CreateContractPage() {
  const router = useRouter();
  
  // Form state
  const [customerId, setCustomerId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [templateId, setTemplateId] = useState('');
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

  // Fetch customers and invoices on mount
  useEffect(() => {
    async function fetchData() {
      try {
        setLoadingData(true);
        
        // Fetch customers
        const customersRes = await fetch('/api/customers');
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

  // Fetch DocuSign templates
  useEffect(() => {
    async function fetchTemplates() {
      try {
        setLoadingTemplates(true);
        
        const templatesRes = await fetch('/api/docusign/templates');
        if (!templatesRes.ok) {
          console.warn('Failed to fetch DocuSign templates:', await templatesRes.text());
          // Don't throw - templates are optional, default template will be used
          return;
        }
        const templatesData = await templatesRes.json();
        setTemplates(templatesData.templates || []);
        
      } catch (err) {
        console.error('Error fetching templates:', err);
        // Don't set error - templates are optional
      } finally {
        setLoadingTemplates(false);
      }
    }
    
    fetchTemplates();
  }, []);

  // Auto-populate signer info when customer is selected
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
      }
    } else {
      setFilteredInvoices([]);
      setInvoiceId('');
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
    
    if (!templateId) {
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
          templateId: templateId || undefined,
          signerName,
          signerEmail,
          expiresInDays: parseInt(expiresInDays),
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
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
            {/* Customer Selection */}
            <div className="space-y-2">
              <Label htmlFor="customer">Customer *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger id="customer">
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} ({customer.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Select the customer who will sign the contract
              </p>
            </div>

            {/* DocuSign Template Selection */}
            <div className="space-y-2">
              <Label htmlFor="template">Contract Template *</Label>
              <Select 
                value={templateId} 
                onValueChange={setTemplateId}
                disabled={loadingTemplates}
              >
                <SelectTrigger id="template">
                  <SelectValue placeholder={loadingTemplates ? "Loading templates..." : "Select a template"} />
                </SelectTrigger>
                <SelectContent>
                  {templates.length === 0 && !loadingTemplates ? (
                    <SelectItem value="no-templates" disabled>
                      No templates available
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
                Select the DocuSign template to use for this contract
              </p>
              {templates.length > 0 && templateId && (
                <div className="mt-2 p-3 bg-gray-50 rounded-md">
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">Template:</span>{' '}
                    {templates.find(t => t.templateId === templateId)?.name}
                  </p>
                  {templates.find(t => t.templateId === templateId)?.description && (
                    <p className="text-xs text-gray-500 mt-1">
                      {templates.find(t => t.templateId === templateId)?.description}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Invoice Selection (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="invoice">Link to Invoice (Optional)</Label>
              <Select 
                value={invoiceId} 
                onValueChange={setInvoiceId}
                disabled={!customerId}
              >
                <SelectTrigger id="invoice">
                  <SelectValue placeholder={customerId ? "Select an invoice" : "Select customer first"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No invoice</SelectItem>
                  {filteredInvoices.map(invoice => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.invoiceNumber || invoice.id} - ${invoice.amount} ({invoice.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Optionally link this contract to an existing invoice
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
                disabled={loading || !customerId || !templateId}
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
