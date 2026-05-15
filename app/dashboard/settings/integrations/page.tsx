'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const dynamic = 'force-dynamic';

interface IntegrationStatus {
  quickbooks: {
    isAuthenticated: boolean;
    companyId: string | null;
    tokenExpiresAt: string | null;
  };
  clint: {
    isConfigured: boolean;
    tokenStatus: string;
  };
  secrets: {
    quickbooks: boolean;
    clint: boolean;
    cron: boolean;
  };
  lastSync: {
    quickbooks: string | null;
    clint: string | null;
  };
}

export default function IntegrationsPage() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectResult, setDisconnectResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/system/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Erro ao carregar status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickBooksConnect = async () => {
    setDisconnectResult(null);
    window.location.href = '/api/quickbooks/auth/connect';
  };

  const handleQuickBooksDisconnect = async () => {
    try {
      setDisconnecting(true);
      setDisconnectResult(null);
      
      const response = await fetch('/api/quickbooks/auth/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setDisconnectResult({
          type: 'success',
          message: 'QuickBooks desconectado com sucesso!',
        });
        // Reload status to update UI
        await loadStatus();
      } else {
        const error = await response.json();
        setDisconnectResult({
          type: 'error',
          message: error.error || 'Erro ao desconectar QuickBooks',
        });
      }
    } catch (error) {
      setDisconnectResult({
        type: 'error',
        message: 'Erro ao desconectar QuickBooks: ' + (error instanceof Error ? error.message : String(error)),
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleGenerateSecrets = async () => {
    try {
      const response = await fetch('/api/system/secrets/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        alert('Secrets gerados com sucesso! Verifique os logs do servidor.');
        loadStatus();
      }
    } catch (error) {
      alert('Erro ao gerar secrets: ' + error);
    }
  };

  if (loading) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Integrações</h1>
        <p className="text-gray-600">Configure e gerencie as integrações do sistema</p>
      </div>

      {/* QuickBooks */}
      <Card>
        <CardHeader>
          <CardTitle>QuickBooks</CardTitle>
          <CardDescription>Sincronização de invoices e clientes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Status de Autenticação</p>
              <p className="text-sm text-gray-600">
                {status?.quickbooks.isAuthenticated ? (
                  <span className="text-green-600">✓ Conectado</span>
                ) : (
                  <span className="text-red-600">✗ Não conectado</span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              {status?.quickbooks.isAuthenticated ? (
                <>
                  <Button onClick={handleQuickBooksConnect} disabled={disconnecting}>
                    Reconectar
                  </Button>
                  <Button 
                    onClick={handleQuickBooksDisconnect} 
                    variant="destructive" 
                    disabled={disconnecting}
                  >
                    {disconnecting ? 'Desconectando...' : 'Desconectar'}
                  </Button>
                </>
              ) : (
                <Button onClick={handleQuickBooksConnect}>
                  Conectar
                </Button>
              )}
            </div>
          </div>

          {status?.quickbooks.isAuthenticated && (
            <>
              <div>
                <p className="text-sm text-gray-600">
                  Company ID: <span className="font-mono">{status.quickbooks.companyId}</span>
                </p>
              </div>
              {status.quickbooks.tokenExpiresAt && (
                <div>
                  <p className="text-sm text-gray-600">
                    Token expira em: {new Date(status.quickbooks.tokenExpiresAt).toLocaleString()}
                  </p>
                </div>
              )}
            </>
          )}

          {disconnectResult && (
            <Alert className={disconnectResult.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertDescription>
                {disconnectResult.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Clint CRM */}
      <Card>
        <CardHeader>
          <CardTitle>Clint CRM</CardTitle>
          <CardDescription>Sincronização comercial de contatos e deals</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Status da API</p>
              <p className="text-sm text-gray-600">
                {status?.clint.isConfigured ? (
                  <span className="text-green-600">✓ Configurado</span>
                ) : (
                  <span className="text-red-600">✗ Não configurado</span>
                )}
              </p>
            </div>
            <a
              href="/dashboard/admin"
              className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Ver Health
            </a>
          </div>
          <p className="text-sm text-gray-600">
            Última sincronização:{" "}
            {status?.lastSync.clint
              ? new Date(status.lastSync.clint).toLocaleString()
              : "Nenhuma sincronização ainda"}
          </p>
        </CardContent>
      </Card>

      {/* Webhook Secrets */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Secrets</CardTitle>
          <CardDescription>Segurança dos webhooks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm font-semibold">QuickBooks</p>
              <p className="text-sm text-gray-600">
                {status?.secrets.quickbooks ? (
                  <span className="text-green-600">✓ Configurado</span>
                ) : (
                  <span className="text-amber-600">⚠ Não configurado</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold">Clint</p>
              <p className="text-sm text-gray-600">
                {status?.secrets.clint ? (
                  <span className="text-green-600">✓ Configurado</span>
                ) : (
                  <span className="text-amber-600">⚠ Não configurado</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold">Cron</p>
              <p className="text-sm text-gray-600">
                {status?.secrets.cron ? (
                  <span className="text-green-600">✓ Configurado</span>
                ) : (
                  <span className="text-amber-600">⚠ Não configurado</span>
                )}
              </p>
            </div>
          </div>

          <Button onClick={handleGenerateSecrets} variant="secondary">
            Gerar/Atualizar Secrets
          </Button>

          <Alert className="border-blue-200 bg-blue-50">
            <AlertDescription className="text-sm">
              Secrets são chaves criptografadas usadas para validar webhooks. Depois de gerar, você precisa
              configurá-los no Intuit Developer Portal.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Últimas Sincronizações */}
      <Card>
        <CardHeader>
          <CardTitle>Últimas Sincronizações</CardTitle>
          <CardDescription>Histórico de sincronização</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-semibold">QuickBooks</p>
            <p className="text-sm text-gray-600">
              {status?.lastSync.quickbooks
                ? `Última sincronização: ${new Date(status.lastSync.quickbooks).toLocaleString()}`
                : 'Nenhuma sincronização ainda'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Instruções */}
      <Card>
        <CardHeader>
          <CardTitle>Próximos Passos</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 list-decimal list-inside text-sm">
            <li>Conectar QuickBooks clicando no botão "Conectar"</li>
            <li>Gerar secrets de webhook para maior segurança</li>
            <li>Configurar os webhooks no Intuit Developer Portal com as URLs fornecidas</li>
            <li>Verificar os logs de sincronização no dashboard</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
