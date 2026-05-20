#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const allowedLocalHosts = new Set(["localhost", "127.0.0.1", "::1"]);

async function main() {
  const args = process.argv.slice(2);
  const skipDb = args.includes("--skip-db");
  const envFileArg = args.find((arg) => !arg.startsWith("--"));

  if (!envFileArg) {
    console.error("Usage: node scripts/verify-local-safe-env.js <env-file> [--skip-db]");
    process.exit(1);
  }

  const envPath = path.resolve(process.cwd(), envFileArg);
  if (!fs.existsSync(envPath)) {
    console.error(`Env file not found: ${envPath}`);
    process.exit(1);
  }

  const parsed = dotenv.parse(fs.readFileSync(envPath));
  const failures = [];
  const warnings = [];

  function requireValue(key) {
    const value = parsed[key];
    if (!value) {
      failures.push(`${key} is missing`);
    }
    return value;
  }

  function validateLocalUrl(key) {
    const value = requireValue(key);
    if (!value) return;
    try {
      const url = new URL(value);
      if (!allowedLocalHosts.has(url.hostname)) {
        failures.push(`${key} must point to localhost/127.0.0.1/::1, received host ${url.hostname}`);
      }
    } catch {
      failures.push(`${key} is not a valid URL`);
    }
  }

  validateLocalUrl("POSTGRES_PRISMA_URL");
  validateLocalUrl("POSTGRES_URL_NON_POOLING");
  validateLocalUrl("NEXTAUTH_URL");

  const qbEnvironment = parsed.QUICKBOOKS_ENVIRONMENT || "sandbox";
  if (qbEnvironment === "production") {
    failures.push("QUICKBOOKS_ENVIRONMENT must not be production for local-safe UAT");
  }

  if (!parsed.CRON_SECRET) {
    failures.push("CRON_SECRET is missing");
  }

  if (!parsed.NEXTAUTH_SECRET) {
    failures.push("NEXTAUTH_SECRET is missing");
  }

  if (parsed.QUICKBOOKS_ACCESS_TOKEN || parsed.QUICKBOOKS_REFRESH_TOKEN || parsed.QUICKBOOKS_COMPANY_ID) {
    warnings.push("QuickBooks tokens/company id are present. Confirm they belong to sandbox only.");
  }

  if (!skipDb) {
    Object.assign(process.env, parsed);

    let PrismaClient;
    try {
      ({ PrismaClient } = require("@prisma/client"));
    } catch (error) {
      failures.push(`Failed to load Prisma client: ${error.message}`);
    }

    if (PrismaClient) {
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: parsed.POSTGRES_PRISMA_URL,
          },
        },
      });

      try {
        await prisma.$connect();

        try {
          const config = await prisma.systemConfig.findUnique({
            where: { id: "system" },
            select: {
              quickbooks_is_authenticated: true,
              quickbooks_company_id: true,
            },
          });

          if (config?.quickbooks_is_authenticated) {
            failures.push(
              `system_config indicates QuickBooks is authenticated for company ${config.quickbooks_company_id || "unknown"}`
            );
          }
        } catch (error) {
          warnings.push(`Skipping system_config auth check: ${error.message}`);
        }
      } catch (error) {
        failures.push(`Failed to connect to local-safe database: ${error.message}`);
      } finally {
        await prisma.$disconnect().catch(() => {});
      }
    }
  }

  if (failures.length > 0) {
    console.error("Local-safe environment check failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    if (warnings.length > 0) {
      console.error("Warnings:");
      for (const warning of warnings) {
        console.error(`- ${warning}`);
      }
    }
    process.exit(1);
  }

  console.log("Local-safe environment check passed.");
  if (warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
