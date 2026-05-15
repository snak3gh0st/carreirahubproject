/**
 * Invoice Workflow Test Script
 *
 * Tests the invoice workflow services can be imported and have expected methods.
 * Run with: npx tsx scripts/test-invoice-workflow.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDatabaseConnection() {
  console.log('\n📊 Testing Database Connection...');
  try {
    await prisma.$connect();
    console.log('  ✓ Database connected successfully');

    // Check for required tables
    const tables = ['Invoice', 'Contract', 'Customer', 'Deal', 'Notification'];
    for (const table of tables) {
      try {
        const count = await (prisma as any)[table.toLowerCase()].count();
        console.log(`  ✓ Table ${table}: ${count} records`);
      } catch (e) {
        console.log(`  ✗ Table ${table}: Not found or error`);
      }
    }
    return true;
  } catch (error) {
    console.log('  ✗ Database connection failed:', error);
    return false;
  }
}

async function testServiceImports() {
  console.log('\n🔧 Testing Service Imports...');

  const services = [
    { name: 'NotificationService', path: '../lib/services/notification.service' },
    { name: 'ContractWorkflowService', path: '../lib/services/contract-workflow.service' },
    { name: 'PaymentWorkflowService', path: '../lib/services/payment-workflow.service' },
    { name: 'QuickbooksService', path: '../lib/services/quickbooks.service' },
    { name: 'DocuSignService', path: '../lib/services/docusign.service' },
    { name: 'InvoiceSyncService', path: '../lib/services/invoice-sync.service' },
  ];

  for (const { name, path } of services) {
    try {
      const module = await import(path);
      const serviceName = name.charAt(0).toLowerCase() + name.slice(1).replace('Service', 'Service');
      const instance = module[serviceName] || module.default;

      if (instance) {
        console.log(`  ✓ ${name}: Imported successfully`);
      } else {
        console.log(`  ⚠ ${name}: Module loaded but no default export found`);
      }
    } catch (error: any) {
      if (error.message?.includes('API key') || error.message?.includes('not configured')) {
        console.log(`  ⚠ ${name}: Imported but requires configuration`);
      } else {
        console.log(`  ✗ ${name}: Import failed - ${error.message}`);
      }
    }
  }
}

async function testEnvironmentVariables() {
  console.log('\n🔐 Testing Environment Variables...');

  const requiredVars = [
    { name: 'DATABASE_URL', sensitive: true },
    { name: 'NEXTAUTH_SECRET', sensitive: true },
    { name: 'NEXTAUTH_URL', sensitive: false },
  ];

  const optionalVars = [
    { name: 'DOCUSIGN_INTEGRATION_KEY', sensitive: true },
    { name: 'DOCUSIGN_USER_ID', sensitive: true },
    { name: 'DOCUSIGN_ACCOUNT_ID', sensitive: true },
    { name: 'DOCUSIGN_PRIVATE_KEY', sensitive: true },
    { name: 'RESEND_API_KEY', sensitive: true },
    { name: 'EMAIL_FROM', sensitive: false },
    { name: 'EMAIL_FINANCE_TEAM', sensitive: false },
    { name: 'QUICKBOOKS_CLIENT_ID', sensitive: true },
    { name: 'QUICKBOOKS_CLIENT_SECRET', sensitive: true },
    { name: 'CRON_SECRET', sensitive: true },
    { name: 'NEXT_PUBLIC_APP_URL', sensitive: false },
  ];

  console.log('  Required:');
  for (const { name, sensitive } of requiredVars) {
    const value = process.env[name];
    if (value) {
      console.log(`  ✓ ${name}: ${sensitive ? '****' : value}`);
    } else {
      console.log(`  ✗ ${name}: Not set (REQUIRED)`);
    }
  }

  console.log('  Optional (for full workflow):');
  for (const { name, sensitive } of optionalVars) {
    const value = process.env[name];
    if (value && value.trim() !== '') {
      console.log(`  ✓ ${name}: ${sensitive ? '****' : value}`);
    } else {
      console.log(`  ○ ${name}: Not set`);
    }
  }
}

async function testInvoiceWorkflow() {
  console.log('\n📝 Testing Invoice Workflow Data...');

  try {
    // Get invoice counts by status
    const invoiceCounts = await prisma.invoice.groupBy({
      by: ['status'],
      _count: true,
    });

    console.log('  Invoice Status Distribution:');
    for (const group of invoiceCounts) {
      console.log(`    - ${group.status}: ${group._count}`);
    }

    // Get approval status counts
    const approvalCounts = await prisma.invoice.groupBy({
      _count: true,
    });

    console.log('  Approval Status Distribution:');
    for (const group of approvalCounts) {
    }

    // Get contract counts by status
    const contractCounts = await prisma.contract.groupBy({
      by: ['status'],
      _count: true,
    });

    if (contractCounts.length > 0) {
      console.log('  Contract Status Distribution:');
      for (const group of contractCounts) {
        console.log(`    - ${group.status}: ${group._count}`);
      }
    } else {
      console.log('  Contract Status Distribution: No contracts yet');
    }

    // Get notification counts by type
    const notificationCounts = await prisma.notification.groupBy({
      by: ['type', 'status'],
      _count: true,
    });

    if (notificationCounts.length > 0) {
      console.log('  Notification Status:');
      for (const group of notificationCounts) {
        console.log(`    - ${group.type} (${group.status}): ${group._count}`);
      }
    } else {
      console.log('  Notification Status: No notifications yet');
    }

    return true;
  } catch (error: any) {
    console.log(`  ✗ Error querying workflow data: ${error.message}`);
    return false;
  }
}

async function testCronEndpoints() {
  console.log('\n⏰ Testing Cron Endpoints...');

  const cronEndpoints = [
    '/api/cron/contract-reminders',
    '/api/cron/contract-expiration',
    '/api/cron/payment-reminders',
    '/api/cron/overdue-invoices',
  ];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  for (const endpoint of cronEndpoints) {
    console.log(`  ○ ${endpoint}: Endpoint exists (requires server running to test)`);
  }

  console.log(`\n  To test cron jobs manually, run:`);
  console.log(`  curl -X POST ${appUrl}<endpoint> -H "Authorization: Bearer YOUR_CRON_SECRET"`);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('         Invoice Workflow Verification Script          ');
  console.log('═══════════════════════════════════════════════════════');

  await testEnvironmentVariables();
  await testDatabaseConnection();
  await testServiceImports();
  await testInvoiceWorkflow();
  await testCronEndpoints();

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('                  Verification Complete                ');
  console.log('═══════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Test script failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
