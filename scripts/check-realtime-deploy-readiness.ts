import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { config as loadDotenv } from "dotenv";
import { PrismaClient } from "@prisma/client";

const ENV_FILE = process.env.REALTIME_DEPLOY_ENV_FILE || ".env.local";
const REQUIRED_MIGRATIONS = [
  "20260518120000_add_english_realtime_tests",
  "20260518153000_add_realtime_usage_tracking",
  "20260518154000_add_ai_usage_events",
  "20260518161000_add_ai_mock_interview_sessions",
];
const REQUIRED_COLUMNS = [
  "usageInputTextTokens",
  "usageCachedInputTextTokens",
  "usageInputAudioTokens",
  "usageOutputTextTokens",
  "usageOutputAudioTokens",
  "usageTotalTokens",
  "usageEstimatedCostUsd",
  "usageCapturedAt",
];
const REQUIRED_MOCK_INTERVIEW_COLUMNS = [
  "overallScore",
  "communicationScore",
  "experienceScore",
  "problemSolvingScore",
  "roleFitScore",
  "executivePresenceScore",
  "hiringSignal",
  "report",
  "cvContext",
  "usageInputTextTokens",
  "usageCachedInputTextTokens",
  "usageInputAudioTokens",
  "usageOutputTextTokens",
  "usageOutputAudioTokens",
  "usageTotalTokens",
  "usageEstimatedCostUsd",
  "usageCapturedAt",
];

function sqlStringList(values: string[]): string {
  return values.map((value) => `'${value.replace(/'/g, "''")}'`).join(", ");
}

if (existsSync(ENV_FILE)) {
  loadDotenv({ path: ENV_FILE, override: true });
}

function fail(message: string) {
  console.error(`[fail] ${message}`);
  process.exitCode = 1;
}

function pass(message: string) {
  console.log(`[ok] ${message}`);
}

async function main() {
  if (!process.env.POSTGRES_PRISMA_URL) {
    fail("POSTGRES_PRISMA_URL is missing");
  }
  if (!process.env.POSTGRES_URL_NON_POOLING) {
    fail("POSTGRES_URL_NON_POOLING is missing");
  }
  if (!process.env.OPENAI_REALTIME_API_KEY && !process.env.OPENAI_API_KEY) {
    fail("OPENAI_REALTIME_API_KEY or OPENAI_API_KEY is missing");
  }
  if (process.exitCode) return;

  pass(`Loaded deploy env from ${existsSync(ENV_FILE) ? ENV_FILE : "process env"}`);

  const prisma = new PrismaClient();
  try {
    const tableRows = await prisma.$queryRawUnsafe<Array<{ table_name: string | null }>>(
      "SELECT to_regclass('public.english_realtime_tests')::text AS table_name"
    );
    if (!tableRows[0]?.table_name) {
      fail("english_realtime_tests table is missing");
    } else {
      pass("english_realtime_tests table exists");
    }

    const columnRows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'english_realtime_tests'
         AND column_name IN (${sqlStringList(REQUIRED_COLUMNS)})`
    );
    const existingColumns = new Set(columnRows.map((row) => row.column_name));
    for (const column of REQUIRED_COLUMNS) {
      if (!existingColumns.has(column)) {
        fail(`english_realtime_tests.${column} is missing`);
      }
    }
    if (REQUIRED_COLUMNS.every((column) => existingColumns.has(column))) {
      pass("Realtime usage tracking columns exist");
    }

    const usageEventTableRows = await prisma.$queryRawUnsafe<Array<{ table_name: string | null }>>(
      "SELECT to_regclass('public.ai_usage_events')::text AS table_name"
    );
    if (!usageEventTableRows[0]?.table_name) {
      fail("ai_usage_events table is missing");
    } else {
      pass("ai_usage_events table exists");
    }

    const mockInterviewTableRows = await prisma.$queryRawUnsafe<Array<{ table_name: string | null }>>(
      "SELECT to_regclass('public.ai_mock_interview_sessions')::text AS table_name"
    );
    if (!mockInterviewTableRows[0]?.table_name) {
      fail("ai_mock_interview_sessions table is missing");
    } else {
      pass("ai_mock_interview_sessions table exists");
    }

    const mockColumnRows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'ai_mock_interview_sessions'
         AND column_name IN (${sqlStringList(REQUIRED_MOCK_INTERVIEW_COLUMNS)})`
    );
    const existingMockColumns = new Set(mockColumnRows.map((row) => row.column_name));
    for (const column of REQUIRED_MOCK_INTERVIEW_COLUMNS) {
      if (!existingMockColumns.has(column)) {
        fail(`ai_mock_interview_sessions.${column} is missing`);
      }
    }
    if (REQUIRED_MOCK_INTERVIEW_COLUMNS.every((column) => existingMockColumns.has(column))) {
      pass("AI mock interview columns exist");
    }

    const migrationRows = await prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
      `SELECT migration_name
       FROM _prisma_migrations
       WHERE migration_name IN (${sqlStringList(REQUIRED_MIGRATIONS)})`
    );
    const appliedMigrations = new Set(migrationRows.map((row) => row.migration_name));
    const missingMigrations = REQUIRED_MIGRATIONS.filter(
      (migration) => !appliedMigrations.has(migration)
    );

    if (missingMigrations.length === 0) {
      pass("Realtime migrations are marked applied");
    } else {
      fail(`Realtime migrations are not marked applied: ${missingMigrations.join(", ")}`);
    }

    const diff = spawnSync(
      "npx",
      [
        "prisma",
        "migrate",
        "diff",
        "--from-url",
        process.env.POSTGRES_PRISMA_URL!,
        "--to-schema-datamodel",
        "prisma/schema.prisma",
        "--script",
      ],
      {
        encoding: "utf8",
        env: process.env,
      }
    );

    if (diff.status !== 0) {
      fail("Prisma migrate diff failed");
      if (diff.stderr.trim()) console.error(diff.stderr.trim());
    } else if (diff.stdout.trim() && diff.stdout.trim() !== "-- This is an empty migration.") {
      fail("Database schema differs from prisma/schema.prisma");
      console.error(diff.stdout.trim());
    } else {
      pass("Prisma schema diff is empty");
      if (missingMigrations.length > 0) {
        console.error("Physical schema matches, but migration history is missing rows.");
        console.error("After confirming this is the intended database, resolve with:");
        for (const migration of missingMigrations) {
          console.error(`  npx prisma migrate resolve --applied ${migration}`);
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  if (process.exitCode) {
    process.exit(process.exitCode);
  }
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
