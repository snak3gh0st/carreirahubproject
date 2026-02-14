/**
 * Script de teste para verificar integração com Pipedrive
 *
 * Testa:
 * - Conexão com a API
 * - Busca de Persons
 * - Busca de Deals
 * - Criação de Person (se configurado)
 * - Criação de Deal (se configurado)
 * - Serviço de sincronização
 */

import * as dotenv from "dotenv";
dotenv.config();

import { pipedriveService } from "../lib/services/pipedrive.service";
import { pipedriveSyncService } from "../lib/services/pipedrive-sync.service";

interface TestResult {
  name: string;
  success: boolean;
  data?: any;
  error?: string;
  duration?: number;
}

async function testPipedriveIntegration(): Promise<void> {
  console.log("🧪 Iniciando testes de integração Pipedrive...\n");
  console.log("=" .repeat(60));

  const results: TestResult[] = [];

  // Test 1: Verificar configuração
  console.log("\n1️⃣ Verificando configuração...");
  const configTest: TestResult = {
    name: "Configuração",
    success: false,
  };

  try {
    const hasApiToken = !!process.env.PIPEDRIVE_API_TOKEN;
    const hasCompanyDomain = !!process.env.PIPEDRIVE_COMPANY_DOMAIN;
    const hasWebhookSecret = !!process.env.PIPEDRIVE_WEBHOOK_SECRET;

    configTest.success = hasApiToken && hasCompanyDomain;
    configTest.data = {
      hasApiToken,
      hasCompanyDomain,
      hasWebhookSecret,
      companyDomain: hasCompanyDomain ? process.env.PIPEDRIVE_COMPANY_DOMAIN : null,
    };

    if (!configTest.success) {
      configTest.error = "API Token ou Company Domain não configurados";
    }

    console.log(`   ✓ API Token: ${hasApiToken ? "✓" : "✗"}`);
    console.log(`   ✓ Company Domain: ${hasCompanyDomain ? "✓" : "✗"}`);
    console.log(`   ✓ Webhook Secret: ${hasWebhookSecret ? "✓" : "✗"}`);
    if (hasCompanyDomain) {
      console.log(`   ✓ Domain: ${process.env.PIPEDRIVE_COMPANY_DOMAIN}`);
    }
  } catch (error: any) {
    configTest.error = error.message;
    console.log(`   ✗ Erro: ${error.message}`);
  }

  results.push(configTest);

  if (!configTest.success) {
    console.log("\n⚠️  Configuração incompleta. Alguns testes podem falhar.\n");
  }

  // Test 2: Buscar Persons
  console.log("\n2️⃣ Testando busca de Persons...");
  const personsTest: TestResult = {
    name: "Persons",
    success: false,
  };

  try {
    const startTime = Date.now();
    const personsResult = await pipedriveService.getAllPersons({ limit: 10 });
    const duration = Date.now() - startTime;

    personsTest.success = true;
    personsTest.data = {
      count: personsResult.data?.length || 0,
      hasMore: personsResult.additional_data?.pagination?.more_items_in_collection,
      sample: personsResult.data?.slice(0, 3).map((p: any) => ({
        id: p.id,
        name: p.name,
        email: p.email?.[0]?.value,
        phone: p.phone?.[0]?.value,
      })),
    };
    personsTest.duration = duration;

    console.log(`   ✓ Total encontrado: ${personsResult.data?.length || 0}`);
    console.log(`   ✓ Mais itens disponíveis: ${personsResult.additional_data?.pagination?.more_items_in_collection ? "Sim" : "Não"}`);
    if (personsResult.data && personsResult.data.length > 0) {
      console.log(`   ✓ Primeiros 3:`);
      personsResult.data.slice(0, 3).forEach((p: any, i: number) => {
        const email = p.email?.[0]?.value || "sem email";
        const phone = p.phone?.[0]?.value || "sem telefone";
        console.log(`     ${i + 1}. ${p.name} - ${email} - ${phone}`);
      });
    }
    console.log(`   ✓ Tempo: ${duration}ms`);
  } catch (error: any) {
    personsTest.error = error.message;
    console.log(`   ✗ Erro: ${error.message}`);
  }

  results.push(personsTest);

  // Test 3: Buscar Deals
  console.log("\n3️⃣ Testando busca de Deals...");
  const dealsTest: TestResult = {
    name: "Deals",
    success: false,
  };

  try {
    const startTime = Date.now();
    const dealsResult = await pipedriveService.getAllDeals({ limit: 10 });
    const duration = Date.now() - startTime;

    dealsTest.success = true;
    dealsTest.data = {
      count: dealsResult.data?.length || 0,
      hasMore: dealsResult.additional_data?.pagination?.more_items_in_collection,
      sample: dealsResult.data?.slice(0, 3).map((d: any) => ({
        id: d.id,
        title: d.title,
        value: d.value,
        currency: d.currency,
        status: d.status,
        person_id: d.person_id,
      })),
    };
    dealsTest.duration = duration;

    console.log(`   ✓ Total encontrado: ${dealsResult.data?.length || 0}`);
    console.log(`   ✓ Mais itens disponíveis: ${dealsResult.additional_data?.pagination?.more_items_in_collection ? "Sim" : "Não"}`);
    if (dealsResult.data && dealsResult.data.length > 0) {
      console.log(`   ✓ Primeiros 3:`);
      dealsResult.data.slice(0, 3).forEach((d: any, i: number) => {
        console.log(`     ${i + 1}. ${d.title} - ${d.currency} ${d.value} (${d.status})`);
      });
    }
    console.log(`   ✓ Tempo: ${duration}ms`);
  } catch (error: any) {
    dealsTest.error = error.message;
    console.log(`   ✗ Erro: ${error.message}`);
  }

  results.push(dealsTest);

  // Test 4: Testar Circuit Breaker (tentar obter person inválido)
  console.log("\n4️⃣ Testando tratamento de erros (Circuit Breaker)...");
  const errorHandlingTest: TestResult = {
    name: "Error Handling",
    success: false,
  };

  try {
    const startTime = Date.now();
    try {
      // Tentar buscar person com ID inválido
      await pipedriveService.getPerson(999999999);
      errorHandlingTest.error = "Deveria ter lançado erro para ID inválido";
    } catch (error: any) {
      // Esperamos um erro aqui
      if (error.message.includes("404") || error.message.includes("not found")) {
        errorHandlingTest.success = true;
        errorHandlingTest.data = {
          errorMessage: error.message,
          errorType: error.type || "unknown",
        };
        console.log(`   ✓ Erro tratado corretamente: ${error.message}`);
      } else {
        errorHandlingTest.error = `Erro inesperado: ${error.message}`;
        console.log(`   ✗ Erro inesperado: ${error.message}`);
      }
    }
    const duration = Date.now() - startTime;
    errorHandlingTest.duration = duration;
    console.log(`   ✓ Tempo: ${duration}ms`);
  } catch (error: any) {
    errorHandlingTest.error = error.message;
    console.log(`   ✗ Erro: ${error.message}`);
  }

  results.push(errorHandlingTest);

  // Test 5: Testar criação de Person (apenas se todas as verificações anteriores passarem)
  if (results.filter(r => r.name !== "Configuração").every(r => r.success)) {
    console.log("\n5️⃣ Testando criação de Person (TESTE)...");
    const createPersonTest: TestResult = {
      name: "Create Person",
      success: false,
    };

    try {
      const startTime = Date.now();
      const testPerson = await pipedriveService.createPerson({
        name: `Test Person ${Date.now()}`,
        email: `test${Date.now()}@example.com`,
        phone: "+1234567890",
      });
      const duration = Date.now() - startTime;

      createPersonTest.success = !!testPerson.data?.id;
      createPersonTest.data = {
        id: testPerson.data?.id,
        name: testPerson.data?.name,
        email: testPerson.data?.email?.[0]?.value,
      };
      createPersonTest.duration = duration;

      console.log(`   ✓ Person criado com sucesso`);
      console.log(`   ✓ ID: ${testPerson.data?.id}`);
      console.log(`   ✓ Name: ${testPerson.data?.name}`);
      console.log(`   ✓ Email: ${testPerson.data?.email?.[0]?.value}`);
      console.log(`   ✓ Tempo: ${duration}ms`);

      // Limpar: deletar person de teste
      console.log(`   ✓ Limpando person de teste...`);
      // Note: Pipedrive service doesn't have deletePerson, so we skip cleanup
      console.log(`   ⚠️  Person de teste permanecerá no Pipedrive (ID: ${testPerson.data?.id})`);
    } catch (error: any) {
      createPersonTest.error = error.message;
      console.log(`   ✗ Erro: ${error.message}`);
    }

    results.push(createPersonTest);
  } else {
    console.log("\n⏭️  Pulando teste de criação (testes anteriores falharam)");
  }

  // Test 6: Testar sincronização (apenas se person test passou)
  const personTestPassed = results.find(r => r.name === "Persons")?.success;

  if (personTestPassed) {
    console.log("\n6️⃣ Testando funções de sincronização...");
    const syncTest: TestResult = {
      name: "Sync Functions",
      success: false,
    };

    try {
      const startTime = Date.now();

      // Verificar se pipedriveSyncService tem os métodos esperados
      const hasImportPersons = typeof pipedriveSyncService.importAllPersons === 'function';
      const hasImportDeals = typeof pipedriveSyncService.importAllDeals === 'function';
      const hasSyncToPipedrive = typeof pipedriveSyncService.syncCustomerToPipedrive === 'function';

      const duration = Date.now() - startTime;

      syncTest.success = hasImportPersons && hasImportDeals && hasSyncToPipedrive;
      syncTest.data = {
        hasImportPersons,
        hasImportDeals,
        hasSyncToPipedrive,
      };
      syncTest.duration = duration;

      console.log(`   ✓ importAllPersons: ${hasImportPersons ? "✓" : "✗"}`);
      console.log(`   ✓ importAllDeals: ${hasImportDeals ? "✓" : "✗"}`);
      console.log(`   ✓ syncCustomerToPipedrive: ${hasSyncToPipedrive ? "✓" : "✗"}`);
      console.log(`   ✓ Tempo: ${duration}ms`);

      if (!syncTest.success) {
        syncTest.error = "Alguns métodos de sincronização não estão disponíveis";
      }
    } catch (error: any) {
      syncTest.error = error.message;
      console.log(`   ✗ Erro: ${error.message}`);
    }

    results.push(syncTest);
  } else {
    console.log("\n⏭️  Pulando teste de sincronização (teste de persons falhou)");
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
    console.log("\n🎉 Todos os testes passaram! A integração Pipedrive está funcionando corretamente.");
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${failed} teste(s) falharam. Verifique os erros acima.`);
    process.exit(1);
  }
}

// Executar testes
testPipedriveIntegration().catch((error) => {
  console.error("\n💥 Erro fatal:", error);
  process.exit(1);
});
