import assert from "node:assert/strict";
import test from "node:test";

import {
  getMicrophoneAccessErrorMessage,
  getRealtimeSessionErrorMessage,
} from "../../lib/hub/realtime-browser-errors";

test("getMicrophoneAccessErrorMessage explains blocked microphone permission", () => {
  const message = getMicrophoneAccessErrorMessage({
    name: "NotAllowedError",
    message: "Permission denied",
    secureContext: true,
    language: "en",
  });

  assert.match(message, /permission is blocked/i);
  assert.match(message, /reload/i);
});

test("getMicrophoneAccessErrorMessage explains insecure contexts before browser permission", () => {
  const message = getMicrophoneAccessErrorMessage({
    name: "NotAllowedError",
    message: "Permission denied",
    secureContext: false,
    language: "en",
  });

  assert.match(message, /localhost:3001/i);
});

test("getMicrophoneAccessErrorMessage explains missing input device in Portuguese", () => {
  const message = getMicrophoneAccessErrorMessage({
    name: "NotFoundError",
    message: "",
    secureContext: true,
    language: "pt-BR",
  });

  assert.match(message, /microfone conectado/i);
});

test("getRealtimeSessionErrorMessage explains app auth blocks separately from microphone access", () => {
  const message = getRealtimeSessionErrorMessage({
    status: 403,
    serverError: "Forbidden",
    language: "en",
  });

  assert.match(message, /session was blocked/i);
  assert.doesNotMatch(message, /microphone/i);
});

test("getRealtimeSessionErrorMessage includes server detail for provider failures", () => {
  const message = getRealtimeSessionErrorMessage({
    status: 502,
    serverError: "Failed to start realtime English test",
    language: "en",
  });

  assert.match(message, /Realtime voice session/i);
  assert.match(message, /502/);
  assert.match(message, /Failed to start realtime English test/);
});

test("getRealtimeSessionErrorMessage explains missing OpenAI Realtime model access", () => {
  const message = getRealtimeSessionErrorMessage({
    status: 503,
    serverError: "OpenAI API key does not have access to Realtime models.",
    language: "en",
  });

  assert.match(message, /OpenAI API key/i);
  assert.match(message, /Realtime models/i);
});

test("getRealtimeSessionErrorMessage routes unavailable Realtime access to the written fallback", () => {
  const message = getRealtimeSessionErrorMessage({
    status: 503,
    serverError: "OpenAI API key does not have access to Realtime models. Tried: gpt-realtime-2, gpt-realtime.",
    language: "en",
  });

  assert.match(message, /key\/project/i);
  assert.match(message, /written test/i);
});

test("getRealtimeSessionErrorMessage does not blame Hub auth for provider model rejection", () => {
  const message = getRealtimeSessionErrorMessage({
    status: 403,
    serverError: '{"error":{"code":"model_not_found","message":"The model `gpt-realtime-2` does not exist or you do not have access to it."}}',
    language: "en",
  });

  assert.match(message, /OpenAI rejected/i);
  assert.doesNotMatch(message, /sign in to the Hub/i);
});
