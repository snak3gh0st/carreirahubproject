import assert from "node:assert/strict";
import test from "node:test";

import {
  COLLECTION_CALL_PROVIDER,
  buildCollectionCallOpenAiAcceptPayload,
  buildCollectionCallSipUri,
  buildCollectionCallTwimlUrl,
  isCollectionVoiceConfigured,
  mapTwilioCallStatus,
  normalizeCollectionPhoneNumber,
} from "../lib/services/collection-call-voice";

test("collection call provider uses Twilio plus OpenAI Realtime", () => {
  assert.equal(COLLECTION_CALL_PROVIDER, "TWILIO_OPENAI_REALTIME");
});

test("normalizeCollectionPhoneNumber returns E.164 numbers with Brazil fallback", () => {
  assert.equal(normalizeCollectionPhoneNumber("(11) 99999-8888"), "+5511999998888");
  assert.equal(normalizeCollectionPhoneNumber("+1 (407) 555-0100"), "+14075550100");
});

test("isCollectionVoiceConfigured requires Twilio plus OpenAI config", () => {
  assert.equal(
    isCollectionVoiceConfigured({
      TWILIO_ACCOUNT_SID: "AC123",
      TWILIO_AUTH_TOKEN: "token",
      TWILIO_PHONE_NUMBER: "+14075550199",
    }),
    false
  );

  assert.equal(
    isCollectionVoiceConfigured({
      TWILIO_ACCOUNT_SID: "AC123",
      TWILIO_AUTH_TOKEN: "token",
      TWILIO_PHONE_NUMBER: "+14075550199",
      COLLECTION_CALL_PUBLIC_BASE_URL: "https://app.carreirausa.com",
      OPENAI_API_KEY: "sk-test",
      OPENAI_PROJECT_ID: "proj_123",
    }),
    true
  );
});

test("buildCollectionCallTwimlUrl points Twilio at the collection TwiML endpoint", () => {
  assert.equal(
    buildCollectionCallTwimlUrl("https://app.carreirausa.com/", "call_123"),
    "https://app.carreirausa.com/api/webhooks/collection-calls/twilio/twiml?collectionCallId=call_123"
  );
});

test("buildCollectionCallSipUri targets OpenAI Realtime SIP with collection call metadata", () => {
  assert.equal(
    buildCollectionCallSipUri({
      projectId: "proj_abc",
      collectionCallId: "collection_call_123",
    }),
    "sip:proj_abc@sip.api.openai.com;transport=tls?X-Collection-Call-Id=collection_call_123"
  );
});

test("mapTwilioCallStatus maps provider statuses to CollectionCallStatus values", () => {
  assert.equal(mapTwilioCallStatus("queued"), "PENDING");
  assert.equal(mapTwilioCallStatus("ringing"), "IN_PROGRESS");
  assert.equal(mapTwilioCallStatus("in-progress"), "IN_PROGRESS");
  assert.equal(mapTwilioCallStatus("completed"), "COMPLETED");
  assert.equal(mapTwilioCallStatus("busy"), "BUSY");
  assert.equal(mapTwilioCallStatus("no-answer"), "NO_ANSWER");
  assert.equal(mapTwilioCallStatus("failed"), "FAILED");
  assert.equal(mapTwilioCallStatus("canceled"), "CANCELLED");
});

test("buildCollectionCallOpenAiAcceptPayload keeps collection voice on gpt-realtime-2", () => {
  const payload = buildCollectionCallOpenAiAcceptPayload({
    model: "gpt-realtime-2",
    voice: "marin",
    customerName: "Maria Silva",
    invoiceNumber: "INV-100",
    amountDue: 1250.5,
    daysOverdue: 8,
    paymentUrl: "https://app.carreirausa.com/hub/pay/inv_123",
  });

  assert.equal(payload.type, "realtime");
  assert.equal(payload.model, "gpt-realtime-2");
  assert.equal(payload.audio.output.voice, "marin");
  assert.match(payload.instructions, /Maria Silva/);
  assert.match(payload.instructions, /INV-100/);
  assert.match(payload.instructions, /R\$ 1\.250,50/);
  assert.match(payload.instructions, /8 dias/);
  assert.match(payload.instructions, /Nunca ameace/i);
  assert.match(payload.instructions, /handoff humano/i);
});
