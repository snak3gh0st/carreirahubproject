#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const dotenv = require("dotenv");

const [, , envFileArg, ...command] = process.argv;

if (!envFileArg || command.length === 0) {
  console.error("Usage: node scripts/run-with-env.js <env-file> <command> [args...]");
  process.exit(1);
}

const envPath = path.resolve(process.cwd(), envFileArg);

if (!fs.existsSync(envPath)) {
  console.error(`Env file not found: ${envPath}`);
  process.exit(1);
}

const parsed = dotenv.parse(fs.readFileSync(envPath));
const child = spawn(command[0], command.slice(1), {
  cwd: process.cwd(),
  stdio: "inherit",
  env: {
    ...process.env,
    ...parsed,
  },
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
