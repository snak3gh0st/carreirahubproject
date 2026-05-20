#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const cwd = process.cwd();
const sharedEnvPath = path.join(cwd, ".env.local");
const safeEnvPath = path.join(cwd, ".env.uat.local");
const backupEnvPath = path.join(cwd, ".env.local.shared-backup");

if (!fs.existsSync(safeEnvPath)) {
  console.error("Missing .env.uat.local. Create it from .env.uat.local.example first.");
  process.exit(1);
}

if (fs.existsSync(sharedEnvPath) && !fs.existsSync(backupEnvPath)) {
  fs.copyFileSync(sharedEnvPath, backupEnvPath);
  console.log("Backed up existing .env.local to .env.local.shared-backup");
}

fs.copyFileSync(safeEnvPath, sharedEnvPath);
console.log("Activated local-safe environment in .env.local");
