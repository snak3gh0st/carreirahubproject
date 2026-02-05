/**
 * QuickBooks Payment Sync Script
 * 
 * Run: npx tsx scripts/sync-quickbooks-payments.ts
 */

import { quickbooksSyncService } from "../lib/services/quickbooks-sync.service";

async function syncPayments() {
  console.log("🔄 Sincronizando pagamentos do QuickBooks...\n");

  try {
    console.log("📊 Iniciando sincronização completa (Customers + Invoices + Payments + Items)...\n");

    const result = await quickbooksSyncService.sync({
      syncCustomers: true,
      syncInvoices: true,
      syncPayments: true,  // ← Importante: incluir pagamentos
      syncItems: true,
      maxResults: 1000,
      incremental: false,
    });

    console.log("\n✅ Sincronização concluída!\n");
    console.log("=".repeat(60));

    if (result.customers) {
      console.log(`\n👥 Customers:
  - Total: ${result.customers.total}
  - Sincronizados: ${result.customers.synced}
  - Atualizados: ${result.customers.updated}
  - Erros: ${result.customers.errors}`);
    }

    if (result.invoices) {
      console.log(`\n📄 Invoices:
  - Total: ${result.invoices.total}
  - Sincronizados: ${result.invoices.synced}
  - Atualizados: ${result.invoices.updated}
  - Erros: ${result.invoices.errors}`);
    }

    if (result.payments) {
      console.log(`\n💰 Payments:
  - Total encontrados: ${result.payments.total}
  - Sincronizados: ${result.payments.synced}
  - Erros: ${result.payments.errors}`);
    }

    if (result.items) {
      console.log(`\n📦 Items:
  - Total: ${result.items.total}
  - Sincronizados: ${result.items.synced}
  - Erros: ${result.items.errors}`);
    }

    if (result.duration) {
      console.log(`\n⏱️  Duração: ${result.duration}ms`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("🎉 Pronto! Os dados de pagamento agora estão disponíveis nos dashboards.");

  } catch (error) {
    console.error("\n❌ Erro durante sincronização:", error);
    process.exit(1);
  }
}

syncPayments();
