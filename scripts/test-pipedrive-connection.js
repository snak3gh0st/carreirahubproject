// Test Pipedrive API connectivity
const fetch = require('node-fetch');

const API_TOKEN = process.env.PIPEDRIVE_API_TOKEN || "5612a5778a8ad5b47a6a87ffd520af2c5705df32";
const COMPANY_DOMAIN = process.env.PIPEDRIVE_COMPANY_DOMAIN || "carreirausa2";
const BASE_URL = `https://${COMPANY_DOMAIN}.pipedrive.com/api/v1`;

async function testConnection() {
  console.log("Testing Pipedrive API connection...");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`API Token: ${API_TOKEN.substring(0, 10)}...`);
  console.log("");

  try {
    // Test 1: Get current user (simple authenticated request)
    console.log("Test 1: GET /users/me");
    const url = `${BASE_URL}/users/me?api_token=${API_TOKEN}`;

    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000 // 10 second timeout
    });
    const duration = Date.now() - startTime;

    console.log(`  Status: ${response.status} ${response.statusText}`);
    console.log(`  Duration: ${duration}ms`);

    if (response.ok) {
      const data = await response.json();
      console.log(`  Success: ${data.success}`);
      console.log(`  User: ${data.data?.name} (${data.data?.email})`);
    } else {
      const errorText = await response.text();
      console.log(`  Error Response: ${errorText}`);
    }

    console.log("");

    // Test 2: List persons (pagination test)
    console.log("Test 2: GET /persons?limit=1");
    const personsUrl = `${BASE_URL}/persons?limit=1&api_token=${API_TOKEN}`;

    const startTime2 = Date.now();
    const response2 = await fetch(personsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000
    });
    const duration2 = Date.now() - startTime2;

    console.log(`  Status: ${response2.status} ${response2.statusText}`);
    console.log(`  Duration: ${duration2}ms`);

    if (response2.ok) {
      const data = await response2.json();
      console.log(`  Success: ${data.success}`);
      console.log(`  Persons count: ${data.data?.length || 0}`);
    } else {
      const errorText = await response2.text();
      console.log(`  Error Response: ${errorText}`);
    }

    console.log("\n✓ Pipedrive API is accessible");
  } catch (error) {
    console.error("\n✗ Pipedrive API connection failed:");
    console.error(`  Error: ${error.message}`);
    console.error(`  Code: ${error.code}`);
    console.error(`  Type: ${error.type}`);

    if (error.code === 'ENOTFOUND') {
      console.error("\n  → DNS resolution failed. Check PIPEDRIVE_COMPANY_DOMAIN.");
    } else if (error.code === 'ETIMEDOUT' || error.code === 'UND_ERR_SOCKET') {
      console.error("\n  → Connection timeout or socket error. Network/firewall issue?");
    } else if (error.type === 'request-timeout') {
      console.error("\n  → Request timeout. Pipedrive API may be slow or unreachable.");
    }
  }
}

testConnection();
