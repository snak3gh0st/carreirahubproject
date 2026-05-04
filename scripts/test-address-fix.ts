/**
 * Quick test: send one envelope (Anexo B) with the new address format
 * to verify borderStyle/fillColor fix removes the blue background.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const TEMPLATE_ID  = '189a5097-ae86-4f65-b0ac-b7bea1b150bf'; // Anexo B – Pass
const SIGNER_EMAIL = 'loureiropaulo@gmail.com';
const SIGNER_NAME  = 'Paulo Loureiro (TEST)';

const TEST_FIELDS: Record<string, string> = {
  client_name:          SIGNER_NAME,
  client_email:         SIGNER_EMAIL,
  client_cpf:           '000.000.000-00',
  client_passport:      '',
  client_ssn_last4:     '9878',
  client_address:       '1988374 Valencia Blossom Magnolia Street',
  client_address_2:     'Orlando, FL 12312312, USA',
  contract_date_day:    new Date().getDate().toString(),
  contract_date_month:  new Date().toLocaleDateString('pt-BR', { month: 'long' }),
  contract_date_year:   new Date().getFullYear().toString().slice(-2),
  customer_name:        SIGNER_NAME,
  customer_email:       SIGNER_EMAIL,
  invoice_number:       'TEST-001',
  invoice_numbers:      'TEST-001',
  invoice_amount:       '$1.00',
  invoice_due_date:     '05/01/2026',
  amount:               '$1.00',
  due_date:             'May 1, 2026',
  total_amount:         '$1.00',
  installment_count:    '1',
  entry_amount:         '',
  entry_due_date:       '',
  installment_amount:   '$1.00',
  payment_plan:         'Pagamento único: $1.00',
  service_description:  '[TESTE] Address fix verification',
  installment_amount_1: '$1.00',
  due_date_1:           'May 1, 2026',
  due_date_short_1:     '01/05/2026',
  invoice_number_1:     'TEST-001',
  installment_desc_1:   '',
  ...Object.fromEntries(
    Array.from({ length: 11 }, (_, i) => i + 2).flatMap(n => [
      [`installment_amount_${n}`, ''],
      [`due_date_${n}`, ''],
      [`due_date_short_${n}`, ''],
      [`invoice_number_${n}`, ''],
      [`installment_desc_${n}`, ''],
    ])
  ),
};

async function main() {
  const { docusignService } = await import('@/lib/services/docusign.service');

  console.log('Sending test envelope to verify address fix...');
  console.log(`  client_address   = "${TEST_FIELDS.client_address}"`);
  console.log(`  client_address_2 = "${TEST_FIELDS.client_address_2}"`);
  console.log(`  Recipient        : ${SIGNER_EMAIL}`);
  console.log('');

  try {
    const envelopeId = await docusignService.createEnvelopeFromSelectedTemplate(
      TEMPLATE_ID,
      SIGNER_EMAIL,
      SIGNER_NAME,
      TEST_FIELDS,
    );
    console.log(`✓ Envelope sent: ${envelopeId}`);
    console.log(`  Check your email and verify:`);
    console.log(`    1. Address shows in two clean lines`);
    console.log(`    2. No blue background behind the address fields`);
  } catch (err: any) {
    console.error('✗ Error:', err?.message || err);
    process.exit(1);
  }
}

main();
