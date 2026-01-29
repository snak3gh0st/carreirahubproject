/**
 * DocuSign Debug Script
 * Shows the exact JWT payload being sent for troubleshooting
 */

import * as crypto from 'crypto';

const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY || "";
const userId = process.env.DOCUSIGN_USER_ID || "";
const accountId = process.env.DOCUSIGN_ACCOUNT_ID || "";
const baseUrl = process.env.DOCUSIGN_BASE_URL || "";
const privateKey = process.env.DOCUSIGN_PRIVATE_KEY || "";

console.log("\n" + "=".repeat(70));
console.log("🔍 DocuSign JWT Debug Information");
console.log("=".repeat(70));

console.log("\n📋 Configuration:");
console.log(`   Integration Key: ${integrationKey}`);
console.log(`   User ID: ${userId}`);
console.log(`   Account ID: ${accountId}`);
console.log(`   Base URL: ${baseUrl}`);
console.log(`   Private Key Length: ${privateKey.length} chars`);
console.log(`   Private Key Start: ${privateKey.substring(0, 50)}...`);

// Check OAuth base path
const oauthBasePath = baseUrl.includes('demo')
  ? 'https://account-d.docusign.com'
  : 'https://account.docusign.com';

console.log(`   OAuth Base Path: ${oauthBasePath}`);
console.log(`   Environment: ${baseUrl.includes('demo') ? 'SANDBOX' : 'PRODUCTION'}`);

// Create JWT payload
const now = Math.floor(Date.now() / 1000);
const header = {
  typ: 'JWT',
  alg: 'RS256',
};

const payload = {
  iss: integrationKey,
  sub: userId,
  aud: oauthBasePath.replace('https://', ''),
  iat: now,
  exp: now + 3600,
  scope: 'signature impersonation',
};

console.log("\n🔐 JWT Payload:");
console.log(JSON.stringify(payload, null, 2));

// Check if private key is valid format
console.log("\n🔑 Private Key Validation:");
if (privateKey.includes('-----BEGIN RSA PRIVATE KEY-----')) {
  console.log("   ✅ Has BEGIN marker");
} else {
  console.log("   ❌ Missing BEGIN marker");
}

if (privateKey.includes('-----END RSA PRIVATE KEY-----')) {
  console.log("   ✅ Has END marker");
} else {
  console.log("   ❌ Missing END marker");
}

// Try to parse the private key
try {
  const keyObject = crypto.createPrivateKey({
    key: privateKey,
    format: 'pem',
  });
  console.log("   ✅ Private key is valid PEM format");
  console.log(`   ✅ Key type: ${keyObject.asymmetricKeyType}`);
} catch (error) {
  console.log("   ❌ Private key is NOT valid PEM format");
  console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
}

console.log("\n🔗 Consent URL:");
console.log(`   ${oauthBasePath}/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${integrationKey}&redirect_uri=https://carreirausa.sigmaintel.io`);

console.log("\n💡 Next Steps:");
console.log("   1. If private key is invalid, regenerate RSA keypair in DocuSign");
console.log("   2. Make sure you granted consent via the URL above");
console.log("   3. Wait a few minutes after granting consent");
console.log("   4. Try npm run test:docusign again");

console.log("\n" + "=".repeat(70) + "\n");
