import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.production.local', override: false });

const SIGNER_EMAIL = 'loureiropaulo@gmail.com';
const SIGNER_NAME = 'Paulo Loureiro (TEST)';

const TEMPLATES = [
  { annex: 'A', name: 'Pass Advanced',  id: 'd7b4844c-d047-40d1-a7b5-2816b0faad00' },
  { annex: 'B', name: 'Pass',           id: '189a5097-ae86-4f65-b0ac-b7bea1b150bf' },
  { annex: 'C', name: 'Combo Pass',     id: '5ac12740-350a-438f-9839-a9e986283e73' },
  { annex: 'D', name: 'Start',          id: 'b4daba8e-f35b-4054-ae44-2f37ca7225ff' },
  { annex: 'E', name: 'Avulsos',        id: 'f2240a46-524d-41d1-8173-fd117b4be80f' },
  { annex: 'F', name: 'Upgrade',        id: '7da4ad42-c88e-4063-9dd6-50c4371ed298' },
  { annex: 'G', name: 'New Pass',       id: '273f2fe9-39fa-4a06-b9b6-cc988f54f2b2' },
  { annex: 'H', name: 'Treinamento',    id: '657faea8-0425-42d2-9785-876b1e3a85a8' },
  { annex: 'I', name: 'Early Career',   id: '16b5bf7e-7b24-45fd-a853-6a87ddb9079b' },
];

// Minimal test custom fields to populate common tabs without real data
const TEST_FIELDS: Record<string, string> = {
  client_name:          SIGNER_NAME,
  client_email:         SIGNER_EMAIL,
  client_cpf:           '000.000.000-00',
  client_passport:      'TEST123',
  client_ssn_last4:     '0000',
  client_address:       '123 Test Street, Miami, FL 33101, USA',
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
  payment_plan:         'Pagamento unico: $1.00',
  service_description:  '[TESTE] Serviço de teste',
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

async function sendAllTemplateTests() {
  const { docusignService } = await import('@/lib/services/docusign.service');
  console.log('='.repeat(60));
  console.log('DocuSign — Envio de teste para todos os 9 templates');
  console.log(`Destinatário: ${SIGNER_EMAIL}`);
  console.log('='.repeat(60));
  console.log('');

  const results: { annex: string; name: string; id: string; envelopeId?: string; error?: string }[] = [];

  for (const template of TEMPLATES) {
    process.stdout.write(`[Anexo ${template.annex}] ${template.name} (${template.id.slice(0, 8)}...) → `);
    try {
      const envelopeId = await docusignService.createEnvelopeFromSelectedTemplate(
        template.id,
        SIGNER_EMAIL,
        SIGNER_NAME,
        TEST_FIELDS
      );
      console.log(`OK  envelope=${envelopeId}`);
      results.push({ ...template, envelopeId });
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.log(`ERRO  ${msg}`);
      results.push({ ...template, error: msg });
    }
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Resumo');
  console.log('='.repeat(60));

  const ok = results.filter(r => r.envelopeId);
  const fail = results.filter(r => r.error);

  console.log(`Enviados com sucesso: ${ok.length}/${TEMPLATES.length}`);
  for (const r of ok) {
    console.log(`  ✓ Anexo ${r.annex} — ${r.name}: envelope ${r.envelopeId}`);
  }

  if (fail.length > 0) {
    console.log(`\nFalhas: ${fail.length}`);
    for (const r of fail) {
      console.log(`  ✗ Anexo ${r.annex} — ${r.name}: ${r.error}`);
    }
  }
}

sendAllTemplateTests().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
