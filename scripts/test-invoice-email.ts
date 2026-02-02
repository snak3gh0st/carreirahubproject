/**
 * Test Invoice Email Sending
 * 
 * Tests that invoices are created in QuickBooks AND emails are sent via the /send endpoint
 * Run with: npx tsx scripts/test-invoice-email.ts
 */

import { PrismaClient } from '@prisma/client';
import { quickbooksService } from '../lib/services/quickbooks.service';

const prisma = new PrismaClient();

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('         Invoice Email Sending Test                   ');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Step 1: Find or create a test customer with email
    console.log('📧 Step 1: Finding test customer with email...');
    
    let customer = await prisma.customer.findFirst({
      where: {
        email: {
          contains: '@'
        }
      }
    });

    if (!customer) {
      console.log('  No customer with email found. Creating test customer...');
      customer = await prisma.customer.create({
        data: {
          name: 'Test Customer Email',
          email: 'test-invoice@carreirausa.com', // Replace with your test email
          phone: '+1234567890',
        }
      });
      console.log(`  ✓ Created test customer: ${customer.name} (${customer.email})`);
    } else {
      console.log(`  ✓ Found customer: ${customer.name} (${customer.email})`);
    }

    // Step 2: Initialize QuickBooks
    console.log('\n🔧 Step 2: Initializing QuickBooks...');
    await quickbooksService.initialize();
    console.log('  ✓ QuickBooks initialized');

    // Step 3: Get or create customer in QuickBooks
    console.log('\n👤 Step 3: Syncing customer to QuickBooks...');
    const qbCustomer = await quickbooksService.getOrCreateCustomer({
      email: customer.email,
      name: customer.name,
      phone: customer.phone || undefined,
    });
    console.log(`  ✓ QB Customer ID: ${qbCustomer.Id}`);
    console.log(`  ✓ QB Customer Email: ${qbCustomer.PrimaryEmailAddr?.Address || 'NOT SET'}`);

    // Step 4: Ensure customer has email address in QuickBooks
    console.log('\n📧 Step 4: Verifying customer email in QuickBooks...');
    if (customer.email) {
      const emailVerified = await quickbooksService.ensureCustomerEmail(qbCustomer.Id, customer.email);
      if (emailVerified) {
        console.log(`  ✓ Customer email verified: ${customer.email}`);
      } else {
        console.log(`  ⚠️  Failed to set customer email in QuickBooks`);
        throw new Error('Customer email verification failed');
      }
    }

    // Step 5: Get QuickBooks service items
    console.log('\n📦 Step 5: Getting QuickBooks service items...');
    const items = await quickbooksService.getServiceItems();
    const serviceItem = items.find(item => item.type === 'Service');
    
    if (!serviceItem) {
      console.log('  ✗ No service items found in QuickBooks');
      console.log('  Please create at least one service item in QuickBooks first');
      process.exit(1);
    }
    
    console.log(`  ✓ Using service item: ${serviceItem.name} (ID: ${serviceItem.id})`);

    // Step 6: Create invoice with BillEmail
    console.log('\n📄 Step 6: Creating invoice in QuickBooks...');
    const invoiceData = {
      customerId: qbCustomer.Id,
      customerEmail: customer.email, // CRITICAL: Set email on invoice
      dueDate: new Date(),
      docNumber: `TEST-${Date.now().toString().slice(-10)}`, // Max 21 chars
      lineItems: [{
        description: 'Test Service - Email Verification',
        amount: 100.00,
        itemRef: serviceItem.id,
      }],
    };

    console.log('  Invoice data:', JSON.stringify(invoiceData, null, 2));

    const qbInvoice = await quickbooksService.createInvoiceWithBillEmail(invoiceData);
    console.log(`  ✓ Invoice created: ${qbInvoice.Id}`);
    console.log(`  ✓ DocNumber: ${qbInvoice.DocNumber}`);
    console.log(`  ✓ BillEmail: ${qbInvoice.BillEmail?.Address || 'NOT SET'}`);
    console.log(`  ✓ EmailStatus: ${qbInvoice.EmailStatus}`);

    // Step 7: Send invoice via QuickBooks API
    console.log('\n📧 Step 7: Sending invoice email via QuickBooks /send endpoint...');
    console.log(`  Waiting 1 second for QB to process invoice...`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const sendResult = await quickbooksService.sendInvoice(qbInvoice.Id, customer.email);
    
    console.log('\n📊 Send Result:');
    console.log(`  Success: ${sendResult.success}`);
    console.log(`  Email Sent: ${sendResult.sent}`);
    console.log(`  Attempts: ${sendResult.attempts || sendResult.attempt || 1}`);
    console.log(`  Email Status: ${sendResult.emailStatus}`);
    console.log(`  Delivery Info: ${JSON.stringify(sendResult.deliveryInfo || {}, null, 2)}`);
    
    if (sendResult.error) {
      console.log(`  ⚠️  Error: ${sendResult.error}`);
    }

    // Step 8: Verify in integration logs
    console.log('\n📝 Step 8: Checking integration logs...');
    const logs = await prisma.integrationLog.findMany({
      where: {
        service: 'quickbooks',
        payload: {
          path: ['qbInvoiceId'],
          equals: qbInvoice.Id
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });

    console.log(`  Found ${logs.length} log entries:`);
    for (const log of logs) {
      console.log(`    - ${log.action} (${log.status}) at ${log.createdAt.toISOString()}`);
    }

    // Final result
    console.log('\n═══════════════════════════════════════════════════════');
    if (sendResult.success && sendResult.sent) {
      console.log('✅ TEST PASSED: Invoice created and email sent successfully!');
      console.log(`   Check ${customer.email} for the invoice email`);
    } else {
      console.log('⚠️  TEST WARNING: Invoice created but email not sent');
      console.log(`   Error: ${sendResult.error}`);
      console.log(`   QuickBooks Invoice ID: ${qbInvoice.Id}`);
      console.log(`   You can manually send the invoice from QuickBooks UI`);
    }
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
