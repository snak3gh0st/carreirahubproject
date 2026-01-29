/**
 * Generate DocuSign Consent URL
 * 
 * Run this script to get the consent URL, then open it in a browser
 * and click "Allow Access" to grant consent for JWT authentication.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY;
const baseUrl = process.env.DOCUSIGN_BASE_URL || "https://na4.docusign.net";
const redirectUri = process.env.DOCUSIGN_REDIRECT_URI || "https://carreirausa.sigmaintel.io";

if (!integrationKey) {
  console.error("❌ DOCUSIGN_INTEGRATION_KEY not found in environment variables");
  process.exit(1);
}

// Determine OAuth base path based on environment
const oauthBasePath = baseUrl.includes('demo') || baseUrl.includes('sandbox')
  ? 'https://account-d.docusign.com'
  : 'https://account.docusign.com';

// Generate consent URL
const consentUrl = `${oauthBasePath}/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${integrationKey}&redirect_uri=${encodeURIComponent(redirectUri)}`;

console.log("\n" + "=".repeat(70));
console.log("📋 DocuSign Consent URL Generator");
console.log("=".repeat(70));
console.log("\n📌 Configuration:");
console.log(`   - Integration Key: ${integrationKey}`);
console.log(`   - Base URL: ${baseUrl}`);
console.log(`   - OAuth Base: ${oauthBasePath}`);
console.log(`   - Environment: ${baseUrl.includes('demo') ? 'SANDBOX' : 'PRODUCTION'}`);

console.log("\n🔗 Consent URL:");
console.log("\n" + consentUrl);

console.log("\n📖 Instructions:");
console.log("   1. Copy the URL above");
console.log("   2. Open it in your browser");
console.log("   3. Log in with your DocuSign account (CarreiraUSA email)");
console.log("   4. Click 'Allow Access' to grant consent");
console.log("   5. You should see a success message or redirect");
console.log("   6. Run 'npm run test:docusign' again");

console.log("\n" + "=".repeat(70));
console.log("\n");
