import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { buildOpenAIAuthHeaders } from "../lib/services/openai-auth-headers";
import { getRealtimeEnglishTestModelCandidates } from "../lib/hub/realtime-english-test";

type EnvMap = Record<string, string>;

const envFiles = [".env.local", ".env.production.local", ".env"];
const execFileAsync = promisify(execFile);

function parseEnvLine(line: string): [string, string] | null {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!match) return null;
  let value = match[2].trim();
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return [match[1], value];
}

function loadLocalEnv(): EnvMap {
  const loaded: EnvMap = {};

  for (const file of envFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;

    for (const line of fs.readFileSync(fullPath, "utf8").split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      const [key, value] = parsed;
      if (process.env[key] === undefined && loaded[key] === undefined) {
        loaded[key] = value;
      }
    }
  }

  for (const [key, value] of Object.entries(loaded)) {
    process.env[key] = value;
  }

  return loaded;
}

function keyFingerprint(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 12);
}

function redactedScope() {
  return {
    organization: process.env.OPENAI_ORGANIZATION_ID || process.env.OPENAI_ORG_ID || null,
    project: process.env.OPENAI_PROJECT_ID || null,
  };
}

function getRealtimeApiKey(): string | undefined {
  return process.env.OPENAI_REALTIME_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function checkModel(model: string) {
  const apiKey = getRealtimeApiKey();
  const { response, body } = await fetchJson(
    `https://api.openai.com/v1/models/${encodeURIComponent(model)}`,
    {
      headers: buildOpenAIAuthHeaders({ apiKey }),
    }
  );

  return {
    check: "models.retrieve",
    model,
    status: response.status,
    ok: response.ok,
    id: typeof body.id === "string" ? body.id : null,
    error: body.error?.message ?? null,
    code: body.error?.code ?? null,
    requestId: response.headers.get("x-request-id"),
  };
}

async function checkClientSecret(model: string) {
  const apiKey = getRealtimeApiKey();
  const { response, body } = await fetchJson(
    "https://api.openai.com/v1/realtime/client_secrets",
    {
      method: "POST",
      headers: buildOpenAIAuthHeaders({ apiKey, contentType: "application/json" }),
      body: JSON.stringify({
        session: {
          type: "realtime",
          model,
          ...(model === "gpt-realtime-2" ? { reasoning: { effort: "low" } } : {}),
          audio: { output: { voice: "marin" } },
        },
      }),
    }
  );

  return {
    check: "realtime.client_secrets",
    model,
    status: response.status,
    ok: response.ok,
    hasEphemeralValue: typeof body.value === "string",
    sessionModel: body.session?.model ?? null,
    error: body.error?.message ?? null,
    code: body.error?.code ?? null,
    requestId: response.headers.get("x-request-id"),
  };
}

async function checkWebSocket(model: string): Promise<Record<string, unknown>> {
  const python = String.raw`
import json
import os
import sys

try:
    import websocket
except Exception as exc:
    print(json.dumps({
        "check": "realtime.websocket",
        "model": os.environ.get("REALTIME_MODEL"),
        "ok": False,
        "error": "websocket-client is not installed: " + str(exc),
    }))
    sys.exit(0)

model = os.environ["REALTIME_MODEL"]
headers = [
    "Authorization: Bearer " + os.environ["OPENAI_REALTIME_TEST_KEY"],
    "OpenAI-Safety-Identifier: hub_realtime_diagnostic",
]
if os.environ.get("OPENAI_ORGANIZATION_ID"):
    headers.append("OpenAI-Organization: " + os.environ["OPENAI_ORGANIZATION_ID"])
elif os.environ.get("OPENAI_ORG_ID"):
    headers.append("OpenAI-Organization: " + os.environ["OPENAI_ORG_ID"])
if os.environ.get("OPENAI_PROJECT_ID"):
    headers.append("OpenAI-Project: " + os.environ["OPENAI_PROJECT_ID"])

try:
    ws = websocket.create_connection(
        "wss://api.openai.com/v1/realtime?model=" + model,
        header=headers,
        timeout=10,
    )
    event = json.loads(ws.recv())
    ws.close()
    error = event.get("error") or {}
    session = event.get("session") or {}
    print(json.dumps({
        "check": "realtime.websocket",
        "model": model,
        "ok": event.get("type") == "session.created",
        "type": event.get("type"),
        "sessionModel": session.get("model"),
        "error": error.get("message"),
        "code": error.get("code"),
    }))
except Exception as exc:
    print(json.dumps({
        "check": "realtime.websocket",
        "model": model,
        "ok": False,
        "error": str(exc)[:300],
    }))
`;

  const { stdout } = await execFileAsync("python3", ["-c", python], {
    env: { ...process.env, REALTIME_MODEL: model },
    maxBuffer: 1024 * 1024,
  });

  try {
    return JSON.parse(stdout.trim());
  } catch {
    return {
      check: "realtime.websocket",
      model,
      ok: false,
      error: stdout.trim().slice(0, 300) || "Invalid websocket diagnostic output.",
    };
  }
}

async function main() {
  loadLocalEnv();

  const apiKey = getRealtimeApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_REALTIME_API_KEY or OPENAI_API_KEY is missing from the environment or .env.local.");
  }
  process.env.OPENAI_REALTIME_TEST_KEY = apiKey;

  const models = [...getRealtimeEnglishTestModelCandidates(), "gpt-5.2"].filter(
    (model, index, list) => list.indexOf(model) === index
  );

  console.log(JSON.stringify({
    check: "env",
    keyFingerprint: keyFingerprint(apiKey),
    keySource: process.env.OPENAI_REALTIME_API_KEY?.trim() ? "OPENAI_REALTIME_API_KEY" : "OPENAI_API_KEY",
    scope: redactedScope(),
    realtimeCandidates: getRealtimeEnglishTestModelCandidates(),
  }));

  const me = await fetchJson("https://api.openai.com/v1/me", {
    headers: buildOpenAIAuthHeaders({ apiKey }),
  });
  console.log(JSON.stringify({
    check: "me",
    status: me.response.status,
    ok: me.response.ok,
    orgCount: Array.isArray(me.body.orgs?.data) ? me.body.orgs.data.length : null,
    orgs: Array.isArray(me.body.orgs?.data)
      ? me.body.orgs.data.map((org: { id?: string; title?: string; name?: string }) => ({
          id: org.id ?? null,
          title: org.title ?? org.name ?? null,
        }))
      : [],
    error: me.body.error?.message ?? null,
  }));

  for (const model of models) {
    console.log(JSON.stringify(await checkModel(model)));
  }

  for (const model of getRealtimeEnglishTestModelCandidates()) {
    console.log(JSON.stringify(await checkClientSecret(model)));
    console.log(JSON.stringify(await checkWebSocket(model)));
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    check: "fatal",
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exit(1);
});
