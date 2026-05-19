import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVoiceFinalAssessmentPrompt,
  buildVoiceNextQuestionPrompt,
  countStudentTurns,
  getVoiceEnglishFirstQuestion,
  normalizeVoiceTranscript,
  normalizeVoiceTurn,
} from "../../lib/hub/voice-english-test";

test("voice interview starts with a professional English question", () => {
  assert.match(getVoiceEnglishFirstQuestion(), /professional background/i);
});

test("normalizeVoiceTranscript keeps clean student and examiner turns", () => {
  const transcript = normalizeVoiceTranscript([
    { role: "examiner", text: " Question ", at: "2026-01-01T00:00:00.000Z" },
    { role: "student", text: " Answer ", at: "bad", confidence: 2 },
    { role: "student", text: "" },
    null,
  ]);

  assert.deepEqual(transcript, [
    { role: "examiner", text: "Question", at: "2026-01-01T00:00:00.000Z", confidence: null },
    { role: "student", text: "Answer", at: "bad", confidence: 1 },
  ]);
  assert.equal(countStudentTurns(transcript), 1);
});

test("buildVoiceNextQuestionPrompt requests a single JSON interviewer turn", () => {
  const prompt = buildVoiceNextQuestionPrompt({
    language: "pt-BR",
    transcript: [
      { role: "examiner", text: "Tell me about yourself.", at: "now" },
      { role: "student", text: "I work with sales.", at: "now", confidence: 0.8 },
    ],
  });

  assert.match(prompt, /Ask exactly one question/i);
  assert.match(prompt, /Return only valid JSON/i);
  assert.match(prompt, /speech recognition confidence: 0\.80/i);
});

test("normalizeVoiceTurn provides a safe fallback", () => {
  assert.deepEqual(normalizeVoiceTurn({ shouldFinish: true, examinerText: " Thank you. " }), {
    examinerText: "Thank you.",
    shouldFinish: true,
  });
  assert.equal(normalizeVoiceTurn(null).shouldFinish, false);
});

test("buildVoiceFinalAssessmentPrompt includes the oral interview caveat", () => {
  const prompt = buildVoiceFinalAssessmentPrompt({
    language: "en",
    transcript: [{ role: "student", text: "My answer", at: "now", confidence: 0.7 }],
  });

  assert.match(prompt, /browser speech recognition/i);
  assert.match(prompt, /PronunciationScore/i);
  assert.match(prompt, /strict enough/i);
});
