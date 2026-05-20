#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const cwd = process.cwd();
const sharedEnvPath = path.join(cwd, ".env.local");
const safeEnvPath = path.join(cwd, ".env.uat.local");

if (!fs.existsSync(sharedEnvPath) || !fs.existsSync(safeEnvPath)) {
  console.error("Missing .env.local or .env.uat.local. Run `npm run uat:local:env:on` first.");
  process.exit(1);
}

const shared = fs.readFileSync(sharedEnvPath, "utf8");
const safe = fs.readFileSync(safeEnvPath, "utf8");

if (shared !== safe) {
  console.error("Local-safe env is not active in .env.local. Run `npm run uat:local:env:on` first.");
  process.exit(1);
}

console.log("Local-safe env is active.");
