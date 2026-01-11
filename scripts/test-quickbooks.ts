/**
 * Script de teste para verificar integração com QuickBooks
 * 
 * Testa:
 * - Conexão com a API
 * - Busca de Company Info
 * - Busca de Customers
 * - Busca de Invoices
 * - Busca de Items
 * - Busca de Payments
 */

import { quickbooksService } from "../lib/services/quickbooks.service";
import { quickbooksSyncService } from "../lib/services/quickbooks-sync.service";

interface TestResult {
  name: string;
  success: boolean;
  data?: any;
  error?: string;
  duration?: number;
}

async function testQuickBooksIntegration(): Promise<void> {
  console.log("🧪 Iniciando testes de integração QuickBooks...\n");
  console.log("=" .repeat(60));

  const results: TestResult[] = [];

  // Test 1: Verificar configuração
  console.log("\n1️⃣ Verificando configuração...");
  const configTest: TestResult = {
    name: "Configuração",
    success: false,
  };

  try {
    const hasClientId = !!process.env.QUICKBOOKS_CLIENT_ID;
    const hasClientSecret = !!process.env.QUICKBOOKS_CLIENT_SECRET;
    const hasAccessToken = !!process.env.QUICKBOOKS_ACCESS_TOKEN;
    const hasCompanyId = !!process.env.QUICKBOOKS_COMPANY_ID;
    const hasRefreshToken = !!process.env.QUICKBOOKS_REFRESH_TOKEN;
    const environment = process.env.QUICKBOOKS_ENVIRONMENT || "sandbox";

    configTest.success = hasAccessToken && hasCompanyId;
    configTest.data = {
      hasClientId,
      hasClientSecret,
      hasAccessToken,
      hasCompanyId,
      hasRefreshToken,
      environment,
    };

    if (!configTest.success) {
      configTest.error = "Access Token ou Company ID não configurados";
    }

    console.log(`   ✓ Client ID: ${hasClientId ? "✓" : "✗"}`);
    console.log(`   ✓ Client Secret: ${hasClientSecret ? "✓" : "✗"}`);
    console.log(`   ✓ Access Token: ${hasAccessToken ? "✓" : "✗"}`);
    console.log(`   ✓ Company ID: ${hasCompanyId ? "✓" : "✗"}`);
    console.log(`   ✓ Refresh Token: ${hasRefreshToken ? "✓" : "✗"}`);
    console.log(`   ✓ Environment: ${environment}`);
  } catch (error: any) {
    configTest.error = error.message;
    console.log(`   ✗ Erro: ${error.message}`);
  }

  results.push(configTest);

  if (!configTest.success) {
    console.log("\n⚠️  Configuração incompleta. Alguns testes podem falhar.\n");
  }

  // Test 2: Company Info
  console.log("\n2️⃣ Testando conexão (Company Info)...");
  const companyInfoTest: TestResult = {
    name: "Company Info",
    success: false,
  };

  try {
    const startTime = Date.now();
    const companyInfo = await quickbooksService.getCompanyInfo();
    const duration = Date.now() - startTime;

    companyInfoTest.success = true;
    companyInfoTest.data = {
      companyName: companyInfo.CompanyInfo?.CompanyName,
      legalName: companyInfo.CompanyInfo?.LegalName,
      companyId: companyInfo.CompanyInfo?.Id,
    };
    companyInfoTest.duration = duration;

    console.log(`   ✓ Empresa: ${companyInfo.CompanyInfo?.CompanyName}`);
    console.log(`   ✓ Legal Name: ${companyInfo.CompanyInfo?.LegalName}`);
    console.log(`   ✓ ID: ${companyInfo.CompanyInfo?.Id}`);
    console.log(`   ✓ Tempo: ${duration}ms`);
  } catch (error: any) {
    companyInfoTest.error = error.message;
    console.log(`   ✗ Erro: ${error.message}`);
  }

  results.push(companyInfoTest);

  // Test 3: Get Customers
  console.log("\n3️⃣ Testando busca de Customers...");
  const customersTest: TestResult = {
    name: "Customers",
    success: false,
  };

  try {
    const startTime = Date.now();
    const customers = await quickbooksService.getAllCustomers(10);
    const duration = Date.now() - startTime;

    customersTest.success = true;
    customersTest.data = {
      count: customers.length,
      sample: customers.slice(0, 3).map((c: any) => ({
        id: c.Id,
        displayName: c.DisplayName,
        email: c.PrimaryEmailAddr?.Address,
      })),
    };
    customersTest.duration = duration;

    console.log(`   ✓ Total encontrado: ${customers.length}`);
    if (customers.length > 0) {
      console.log(`   ✓ Primeiros 3:`);
      customers.slice(0, 3).forEach((c: any, i: number) => {
        console.log(`     ${i + 1}. ${c.DisplayName} (${c.PrimaryEmailAddr?.Address || "sem email"})`);
      });
    }
    console.log(`   ✓ Tempo: ${duration}ms`);
  } catch (error: any) {
    customersTest.error = error.message;
    console.log(`   ✗ Erro: ${error.message}`);
  }

  results.push(customersTest);

  // Test 4: Get Invoices
  console.log("\n4️⃣ Testando busca de Invoices...");
  const invoicesTest: TestResult = {
    name: "Invoices",
    success: false,
  };

  try {
    const startTime = Date.now();
    const result = await quickbooksService.getAllInvoices(10);
    const duration = Date.now() - startTime;

    invoicesTest.success = true;
    invoicesTest.data = {
      count: result.invoices.length,
      sample: result.invoices.slice(0, 3).map((inv: any) => ({
        id: inv.Id,
        docNumber: inv.DocNumber,
        totalAmt: inv.TotalAmt,
        balance: inv.Balance,
        customerRef: inv.CustomerRef?.value,
      })),
    };
    invoicesTest.duration = duration;

    console.log(`   ✓ Total encontrado: ${result.invoices.length}`);
    if (result.invoices.length > 0) {
      console.log(`   ✓ Primeiras 3:`);
      result.invoices.slice(0, 3).forEach((inv: any, i: number) => {
        console.log(`     ${i + 1}. ${inv.DocNumber || inv.Id} - $${inv.TotalAmt || 0} (Balance: $${inv.Balance || 0})`);
      });
    }
    console.log(`   ✓ Tempo: ${duration}ms`);
  } catch (error: any) {
    invoicesTest.error = error.message;
    console.log(`   ✗ Erro: ${error.message}`);
  }

  results.push(invoicesTest);

  // Test 5: Get Items
  console.log("\n5️⃣ Testando busca de Items...");
  const itemsTest: TestResult = {
    name: "Items",
    success: false,
  };

  try {
    const startTime = Date.now();
    const items = await quickbooksService.getAllItems(10);
    const duration = Date.now() - startTime;

    itemsTest.success = true;
    itemsTest.data = {
      count: items.length,
      sample: items.slice(0, 3).map((item: any) => ({
        id: item.Id,
        name: item.Name,
        type: item.Type,
      })),
    };
    itemsTest.duration = duration;

    console.log(`   ✓ Total encontrado: ${items.length}`);
    if (items.length > 0) {
      console.log(`   ✓ Primeiros 3:`);
      items.slice(0, 3).forEach((item: any, i: number) => {
        console.log(`     ${i + 1}. ${item.Name} (${item.Type})`);
      });
    }
    console.log(`   ✓ Tempo: ${duration}ms`);
  } catch (error: any) {
    itemsTest.error = error.message;
    console.log(`   ✗ Erro: ${error.message}`);
  }

  results.push(itemsTest);

  // Test 6: Get Payments
  console.log("\n6️⃣ Testando busca de Payments...");
  const paymentsTest: TestResult = {
    name: "Payments",
    success: false,
  };

  try {
    const startTime = Date.now();
    const payments = await quickbooksService.getAllPayments(10);
    const duration = Date.now() - startTime;

    paymentsTest.success = true;
    paymentsTest.data = {
      count: payments.length,
      sample: payments.slice(0, 3).map((p: any) => ({
        id: p.Id,
        totalAmt: p.TotalAmt,
        customerRef: p.CustomerRef?.value,
      })),
    };
    paymentsTest.duration = duration;

    console.log(`   ✓ Total encontrado: ${payments.length}`);
    if (payments.length > 0) {
      console.log(`   ✓ Primeiros 3:`);
      payments.slice(0, 3).forEach((p: any, i: number) => {
        console.log(`     ${i + 1}. Payment ${p.Id} - $${p.TotalAmt || 0}`);
      });
    }
    console.log(`   ✓ Tempo: ${duration}ms`);
  } catch (error: any) {
    paymentsTest.error = error.message;
    console.log(`   ✗ Erro: ${error.message}`);
  }

  results.push(paymentsTest);

  // Test 7: Sync Service (opcional - apenas se todos os outros passarem)
  if (results.filter(r => r.name !== "Configuração").every(r => r.success)) {
    console.log("\n7️⃣ Testando sincronização completa...");
    const syncTest: TestResult = {
      name: "Sincronização",
      success: false,
    };

    try {
      const startTime = Date.now();
      const syncResult = await quickbooksSyncService.sync({
        syncCustomers: true,
        syncInvoices: true,
        syncPayments: false,
        syncItems: false,
        maxResults: 10, // Limitar para teste rápido
        incremental: false,
      });
      const duration = Date.now() - startTime;

      syncTest.success = syncResult.success;
      syncTest.data = {
        customers: syncResult.customers,
        invoices: syncResult.invoices,
        duration: syncResult.duration,
      };
      syncTest.duration = duration;

      console.log(`   ✓ Sincronização concluída`);
      console.log(`   ✓ Customers: ${syncResult.customers?.synced || 0} novos, ${syncResult.customers?.updated || 0} atualizados`);
      console.log(`   ✓ Invoices: ${syncResult.invoices?.synced || 0} novos, ${syncResult.invoices?.updated || 0} atualizados`);
      console.log(`   ✓ Tempo total: ${duration}ms`);
    } catch (error: any) {
      syncTest.error = error.message;
      console.log(`   ✗ Erro: ${error.message}`);
    }

    results.push(syncTest);
  } else {
    console.log("\n⏭️  Pulando teste de sincronização (testes anteriores falharam)");
  }

  // Resumo final
  console.log("\n" + "=".repeat(60));
  console.log("\n📊 RESUMO DOS TESTES\n");

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;

  results.forEach((result) => {
    const icon = result.success ? "✅" : "❌";
    const duration = result.duration ? ` (${result.duration}ms)` : "";
    console.log(`${icon} ${result.name}${duration}`);
    if (result.error) {
      console.log(`   └─ Erro: ${result.error}`);
    }
  });

  console.log(`\n📈 Resultado: ${passed}/${total} testes passaram`);

  if (failed === 0) {
    console.log("\n🎉 Todos os testes passaram! A integração QuickBooks está funcionando corretamente.");
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${failed} teste(s) falharam. Verifique os erros acima.`);
    process.exit(1);
  }
}

// Executar testes
testQuickBooksIntegration().catch((error) => {
  console.error("\n💥 Erro fatal:", error);
  process.exit(1);
});






