#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const cwd = process.cwd();
const sharedEnvPath = path.join(cwd, ".env.local");
const safeEnvPath = path.join(cwd, ".env.uat.local");
const backupEnvPath = path.join(cwd, ".env.local.shared-backup");

if (fs.existsSync(backupEnvPath)) {
  fs.copyFileSync(backupEnvPath, sharedEnvPath);
  fs.unlinkSync(backupEnvPath);
  console.log("Restored original .env.local from backup");
  process.exit(0);
}

if (fs.existsSync(sharedEnvPath) && fs.existsSync(safeEnvPath)) {
  const shared = fs.readFileSync(sharedEnvPath, "utf8");
  const safe = fs.readFileSync(safeEnvPath, "utf8");
  if (shared === safe) {
    fs.unlinkSync(sharedEnvPath);
    console.log("Removed local-safe .env.local (no original backup existed)");
    process.exit(0);
  }
}

console.log("No .env.local backup found. Nothing to restore.");
