#!/usr/bin/env tsx
/**
 * QuickBooks API Error Diagnostic Script
 * 
 * This script diagnoses QuickBooks API 400 Bad Request errors by:
 * 1. Checking environment configuration
 * 2. Checking database SystemConfig
 * 3. Testing QuickBooks authentication status
 * 4. Providing actionable steps to resolve the issue
 */

import { prisma } from "@/lib/db";
import { quickbooksService } from "@/lib/services/quickbooks.service";

async function diagnose() {
  console.log("🔍 QuickBooks API Error Diagnostic Tool\n");
  console.log("=" .repeat(60));

  // Step 1: Check environment variables
  console.log("\n1️⃣  Checking Environment Variables...\n");
  
  const envVars = {
    QUICKBOOKS_CLIENT_ID: process.env.QUICKBOOKS_CLIENT_ID,
    QUICKBOOKS_CLIENT_SECRET: process.env.QUICKBOOKS_CLIENT_SECRET,
    QUICKBOOKS_REDIRECT_URI: process.env.QUICKBOOKS_REDIRECT_URI,
    QUICKBOOKS_ENVIRONMENT: process.env.QUICKBOOKS_ENVIRONMENT || "sandbox",
    QUICKBOOKS_ACCESS_TOKEN: process.env.QUICKBOOKS_ACCESS_TOKEN,
    QUICKBOOKS_REFRESH_TOKEN: process.env.QUICKBOOKS_REFRESH_TOKEN,
    QUICKBOOKS_COMPANY_ID: process.env.QUICKBOOKS_COMPANY_ID,
  };

  let hasEnvIssues = false;

  for (const [key, value] of Object.entries(envVars)) {
    const status = value && value.trim() !== "" ? "✅" : "❌";
    const displayValue = value && value.trim() !== "" 
      ? (key.includes("SECRET") || key.includes("TOKEN") 
          ? `${value.substring(0, 10)}...` 
          : value)
      : "(empty)";
    
    console.log(`${status} ${key}: ${displayValue}`);
    
    if (!value || value.trim() === "") {
      if (key === "QUICKBOOKS_ACCESS_TOKEN" || 
          key === "QUICKBOOKS_REFRESH_TOKEN" || 
          key === "QUICKBOOKS_COMPANY_ID") {
        // These should be in the database, not env vars
        console.log(`   ℹ️  ${key} should be stored in database SystemConfig, not .env`);
      } else if (key !== "QUICKBOOKS_ACCESS_TOKEN" && 
                 key !== "QUICKBOOKS_REFRESH_TOKEN" && 
                 key !== "QUICKBOOKS_COMPANY_ID") {
        hasEnvIssues = true;
        console.log(`   ⚠️  ${key} is required in .env`);
      }
    }
  }

  // Step 2: Check database SystemConfig
  console.log("\n2️⃣  Checking Database SystemConfig...\n");

  try {
    const config = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });

    if (!config) {
      console.log("❌ SystemConfig not found in database");
      console.log("   ℹ️  You need to authenticate with QuickBooks first\n");
      console.log("   👉 Visit: http://localhost:3000/api/quickbooks/auth/connect");
      console.log("      to start the OAuth flow and save tokens to the database\n");
      
      return {
        issue: "NOT_AUTHENTICATED",
        solution: "Run OAuth flow to authenticate with QuickBooks",
        url: "/api/quickbooks/auth/connect"
      };
    }

    console.log("✅ SystemConfig found in database\n");

    const configChecks = {
      "Access Token": config.quickbooks_access_token,
      "Refresh Token": config.quickbooks_refresh_token,
      "Company ID": config.quickbooks_company_id,
      "Is Authenticated": config.quickbooks_is_authenticated,
      "Token Expires At": config.quickbooks_token_expires_at,
    };

    let hasDatabaseIssues = false;

    for (const [key, value] of Object.entries(configChecks)) {
      if (key === "Is Authenticated") {
        console.log(`${value ? "✅" : "❌"} ${key}: ${value}`);
        if (!value) {
          hasDatabaseIssues = true;
        }
      } else if (key === "Token Expires At") {
        if (value) {
          const expiresAt = new Date(value);
          const isExpired = expiresAt < new Date();
          console.log(`${isExpired ? "❌" : "✅"} ${key}: ${expiresAt.toISOString()}`);
          if (isExpired) {
            console.log(`   ⚠️  Token expired! Needs refresh`);
            hasDatabaseIssues = true;
          }
        } else {
          console.log(`❌ ${key}: (not set)`);
        }
      } else {
        const status = value && value.trim() !== "" ? "✅" : "❌";
        const displayValue = value && value.trim() !== "" 
          ? (key.includes("Token") ? `${value.substring(0, 10)}...` : value)
          : "(empty)";
        console.log(`${status} ${key}: ${displayValue}`);
        
        if (!value || value.trim() === "") {
          hasDatabaseIssues = true;
        }
      }
    }

    // Step 3: Test QuickBooks authentication
    console.log("\n3️⃣  Testing QuickBooks Authentication...\n");

    if (hasDatabaseIssues) {
      console.log("⚠️  Skipping authentication test due to missing credentials\n");
      return {
        issue: "MISSING_CREDENTIALS",
        solution: "Complete OAuth flow to get valid credentials",
        url: "/api/quickbooks/auth/connect"
      };
    }

    try {
      await quickbooksService.initialize();
      const authStatus = await quickbooksService.getAuthStatus();

      console.log("Authentication Status:");
      console.log(`  • Is Authenticated: ${authStatus.isAuthenticated ? "✅ Yes" : "❌ No"}`);
      console.log(`  • Company ID: ${authStatus.companyId || "(not set)"}`);
      console.log(`  • Token Expires: ${authStatus.tokenExpiresAt ? new Date(authStatus.tokenExpiresAt).toISOString() : "(not set)"}`);

      if (!authStatus.isAuthenticated) {
        return {
          issue: "NOT_AUTHENTICATED",
          solution: "Re-authenticate with QuickBooks",
          url: "/api/quickbooks/auth/connect"
        };
      }

      // Try a simple API call
      console.log("\n4️⃣  Testing QuickBooks API Call...\n");

      try {
        const companyInfo = await quickbooksService.getCompanyInfo();
        console.log("✅ API call successful!");
        console.log(`   Company: ${companyInfo.CompanyInfo?.CompanyName || "Unknown"}`);
        
        return {
          issue: null,
          solution: "QuickBooks is properly configured and working!"
        };
      } catch (apiError: any) {
        console.log("❌ API call failed:");
        console.log(`   Error: ${apiError.message}`);
        console.log(`   Status: ${apiError.status || "unknown"}`);
        
        if (apiError.status === 400) {
          console.log("\n🔍 400 Bad Request Analysis:");
          console.log("   Possible causes:");
          console.log("   • Company ID is invalid or empty");
          console.log("   • Access token is invalid");
          console.log("   • Request format is incorrect");
          console.log("   • API endpoint requires different parameters");
          
          if (!config.quickbooks_company_id || config.quickbooks_company_id.trim() === "") {
            return {
              issue: "EMPTY_COMPANY_ID",
              solution: "Company ID is empty. Re-authenticate to get a valid Company ID",
              url: "/api/quickbooks/auth/connect"
            };
          }
        } else if (apiError.status === 401) {
          console.log("\n🔍 401 Unauthorized - Token expired or invalid");
          return {
            issue: "TOKEN_EXPIRED",
            solution: "Token expired. Re-authenticate to get a new token",
            url: "/api/quickbooks/auth/connect"
          };
        }

        return {
          issue: "API_ERROR",
          solution: `API error (${apiError.status}): ${apiError.message}`,
          error: apiError
        };
      }
    } catch (error: any) {
      console.log("❌ Initialization failed:");
      console.log(`   Error: ${error.message}`);
      
      return {
        issue: "INITIALIZATION_ERROR",
        solution: "Failed to initialize QuickBooks service",
        error
      };
    }
  } catch (error: any) {
    console.log("❌ Database query failed:");
    console.log(`   Error: ${error.message}`);
    
    return {
      issue: "DATABASE_ERROR",
      solution: "Failed to query SystemConfig from database",
      error
    };
  }
}

// Main execution
diagnose()
  .then((result) => {
    console.log("\n" + "=".repeat(60));
    console.log("\n📋 DIAGNOSIS SUMMARY\n");
    
    if (result.issue) {
      console.log(`❌ Issue: ${result.issue}`);
      console.log(`💡 Solution: ${result.solution}`);
      
      if (result.url) {
        console.log(`\n🔗 Action: Visit ${result.url}`);
      }
    } else {
      console.log(`✅ ${result.solution}`);
    }
    
    console.log("\n" + "=".repeat(60) + "\n");
    process.exit(result.issue ? 1 : 0);
  })
  .catch((error) => {
    console.error("\n❌ Fatal error during diagnosis:");
    console.error(error);
    process.exit(1);
  });
