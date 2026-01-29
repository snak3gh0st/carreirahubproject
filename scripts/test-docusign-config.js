#!/usr/bin/env node
// Test DocuSign configuration without TypeScript compilation

const required = [
  'DOCUSIGN_INTEGRATION_KEY',
  'DOCUSIGN_USER_ID', 
  'DOCUSIGN_ACCOUNT_ID',
  'DOCUSIGN_PRIVATE_KEY',
  'DOCUSIGN_BASE_URL',
  'DOCUSIGN_WEBHOOK_SECRET'
];

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  DocuSign Configuration Check');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let missing = 0;
let configured = 0;

required.forEach(v => {
  const val = process.env[v];
  if (!val || val.trim() === '') {
    console.log(`❌ ${v}: NOT SET`);
    missing++;
  } else {
    // Show first 20 chars for verification without exposing full value
    const preview = val.length > 20 ? val.substring(0, 20) + '...' : val;
    console.log(`✅ ${v}: ${preview} (${val.length} chars)`);
    configured++;
  }
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Status: ${configured}/${required.length} configured\n`);

if (missing > 0) {
  console.log('❌ DocuSign NOT READY');
  console.log('\nMissing credentials need to be set in Vercel:');
  console.log('https://vercel.com/pauloloureiros-projects/carreirausa/settings/environment-variables\n');
  process.exit(1);
} else {
  console.log('✅ DocuSign READY - all credentials configured');
  console.log('\nNext: Test JWT authentication with:');
  console.log('npm run test:docusign\n');
  process.exit(0);
}
