import * as dotenv from 'dotenv';
dotenv.config();

import { docusignService } from '@/lib/services/docusign.service';

async function testDocuSignAuth() {
  console.log('Testing DocuSign JWT authentication...\n');
  
  try {
    // Test 1: JWT authentication
    console.log('[1/2] Testing JWT token generation...');
    const token = await docusignService.authenticateWithJWT();
    console.log('✓ JWT authentication successful');
    console.log('  Token received:', token.substring(0, 20) + '...');
    console.log('');
    
    // Test 2: Get account info (verifies token works)
    console.log('[2/2] Testing account info retrieval...');
    const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
    const baseUrl = process.env.DOCUSIGN_BASE_URL;
    const response = await fetch(`${baseUrl}/restapi/v2.1/accounts/${accountId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const account = await response.json();
      console.log('✓ Account info retrieved successfully');
      console.log('  Account name:', account.accountName);
      console.log('  Account status:', account.status);
    } else {
      const errorText = await response.text();
      console.error('✗ Failed to get account info:', response.status, errorText);
      process.exit(1);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✓ All DocuSign authentication tests passed!');
    console.log('='.repeat(60));
    console.log('');
    
  } catch (error) {
    console.error('\n✗ DocuSign authentication test failed:', error);
    console.error('\nPlease check:');
    console.error('  - DOCUSIGN_INTEGRATION_KEY is correct (GUID format)');
    console.error('  - DOCUSIGN_USER_ID is correct (GUID format)');
    console.error('  - DOCUSIGN_ACCOUNT_ID matches your account');
    console.error('  - DOCUSIGN_PRIVATE_KEY is valid RSA private key (PEM format)');
    console.error('  - Admin consent was granted (visit consent URL again)');
    console.error('  - DOCUSIGN_BASE_URL matches your account region');
    process.exit(1);
  }
}

testDocuSignAuth();
