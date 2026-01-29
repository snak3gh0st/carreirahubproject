#!/usr/bin/env tsx
import { generateInvoiceNumber } from "@/lib/utils/invoice-number";

console.log("Testing invoice number format against QuickBooks 21-character limit\n");
console.log("=" .repeat(70));

const testCases = [
  {
    name: "Short customer, short service",
    customerName: "John Doe",
    serviceName: "Service",
  },
  {
    name: "Long customer, long service",
    customerName: "Maria Carolina Santos Silva",
    serviceName: "Immigration Consultation and Documentation Service",
  },
  {
    name: "Real example - Carreira USA",
    customerName: "Carreira USA Student",
    serviceName: "Service - Entry Payment",
  },
  {
    name: "Single word names",
    customerName: "Paulo",
    serviceName: "Consultoria",
  },
];

const installmentTypes: Array<{ type: 'single' | 'entry' | 'installment', num?: number }> = [
  { type: 'single' },
  { type: 'entry' },
  { type: 'installment', num: 1 },
  { type: 'installment', num: 9 },
];

let maxLength = 0;
let allPassed = true;

for (const testCase of testCases) {
  console.log(`\n📋 ${testCase.name}`);
  console.log(`   Customer: ${testCase.customerName}`);
  console.log(`   Service: ${testCase.serviceName}`);
  console.log("");

  for (const installment of installmentTypes) {
    const invoiceNumber = generateInvoiceNumber({
      customerName: testCase.customerName,
      serviceName: testCase.serviceName,
      date: new Date('2026-01-28'),
      installmentType: installment.type,
      installmentNumber: installment.num,
      amount: 1000,
      seriesId: 'TEST123',
    });

    const length = invoiceNumber.length;
    const status = length <= 21 ? "✅" : "❌";
    const typeLabel = installment.num 
      ? `${installment.type} ${installment.num}` 
      : installment.type;

    console.log(`   ${status} ${typeLabel.padEnd(15)} | ${invoiceNumber.padEnd(22)} | ${length} chars`);

    maxLength = Math.max(maxLength, length);
    
    if (length > 21) {
      allPassed = false;
      console.log(`      ⚠️  EXCEEDS LIMIT BY ${length - 21} CHARACTER(S)`);
    }
  }
}

console.log("\n" + "=".repeat(70));
console.log(`\n📊 RESULTS:`);
console.log(`   Max length generated: ${maxLength} characters`);
console.log(`   QuickBooks limit: 21 characters`);

if (allPassed) {
  console.log(`   ✅ ALL TESTS PASSED - Format fits within QB limit`);
} else {
  console.log(`   ❌ SOME TESTS FAILED - Format exceeds QB limit`);
}

console.log("\n" + "=".repeat(70) + "\n");
