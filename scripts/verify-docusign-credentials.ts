/**
 * Verify DocuSign production credentials are correctly configured
 * This script checks for required env vars without calling DocuSign API
 */

const REQUIRED_VARS = [
  'DOCUSIGN_INTEGRATION_KEY',
  'DOCUSIGN_USER_ID',
  'DOCUSIGN_ACCOUNT_ID',
  'DOCUSIGN_PRIVATE_KEY',
  'DOCUSIGN_BASE_URL',
  'DOCUSIGN_WEBHOOK_SECRET'
];

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function verifyCredentials() {
  console.log('Verifying DocuSign credentials configuration...\n');
  
  let allValid = true;
  
  // Check all required variables exist
  for (const varName of REQUIRED_VARS) {
    const value = process.env[varName];
    
    if (!value) {
      console.error(`✗ ${varName}: MISSING`);
      allValid = false;
      continue;
    }
    
    // Validate format based on variable type
    if (varName === 'DOCUSIGN_INTEGRATION_KEY' || varName === 'DOCUSIGN_USER_ID') {
      if (!GUID_PATTERN.test(value)) {
        console.error(`✗ ${varName}: Invalid GUID format (expected 8-4-4-4-12)`);
        allValid = false;
      } else {
        console.log(`✓ ${varName}: Valid GUID`);
      }
    } else if (varName === 'DOCUSIGN_PRIVATE_KEY') {
      if (value.includes('BEGIN RSA PRIVATE KEY') || value.length > 100) {
        console.log(`✓ ${varName}: Present (${value.length} chars)`);
      } else {
        console.error(`✗ ${varName}: Too short or invalid format (expected PEM or base64)`);
        allValid = false;
      }
    } else if (varName === 'DOCUSIGN_BASE_URL') {
      if (value.startsWith('https://') && value.includes('docusign.net')) {
        console.log(`✓ ${varName}: ${value}`);
      } else {
        console.error(`✗ ${varName}: Invalid URL (expected https://*.docusign.net)`);
        allValid = false;
      }
    } else {
      console.log(`✓ ${varName}: Present`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (allValid) {
    console.log('✓ All DocuSign credentials are correctly configured');
    console.log('\nReady to proceed with Plan 05-02 (JWT authentication test)');
    process.exit(0);
  } else {
    console.error('✗ Some credentials are missing or invalid');
    console.error('\nPlease complete Plan 05-01 credential setup before continuing');
    process.exit(1);
  }
}

verifyCredentials();
