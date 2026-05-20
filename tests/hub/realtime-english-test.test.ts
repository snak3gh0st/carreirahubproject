import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRealtimeEnglishTestSession,
  buildRealtimeSafetyIdentifier,
  getRealtimeEnglishTestModelCandidates,
  normalizeRealtimeEnglishResult,
  REALTIME_ENGLISH_TEST_DEFAULT_MODEL,
  REALTIME_ENGLISH_TEST_FALLBACK_MODEL,
} from "../../lib/hub/realtime-english-test";
import {
  REALTIME_ENGLISH_TEST_REQUIRED_STUDENT_TURNS,
  REALTIME_ENGLISH_TEST_STAGES,
  buildEvaluatorUnavailableRealtimeTurnEvaluation,
  getRealtimeEnglishTestProgress,
  isMeaningfulRealtimeStudentTranscript,
  normalizeRealtimeEnglishTranscript,
  normalizeRealtimeEnglishTurnEvaluation,
} from "../../lib/hub/realtime-english-test-flow";
import {
  estimateRealtimeEnglishUsageCostUsd,
  mergeRealtimeEnglishUsageTotals,
  normalizeRealtimeEnglishUsage,
} from "../../lib/hub/realtime-english-test-usage";
import {
  buildRealtimeEnglishConversationMetrics,
  buildRealtimeEnglishDeliveryAnalysis,
} from "../../lib/hub/realtime-english-test-analysis";
import {
  buildRealtimeEnglishResetUpdateData,
  canResetRealtimeEnglishTestStatus,
} from "../../lib/hub/realtime-english-test-ops";

test("buildRealtimeEnglishTestSession uses GPT Realtime 2 with audio-first defaults", () => {
  const session = buildRealtimeEnglishTestSession({ language: "pt-BR" });

  assert.equal(REALTIME_ENGLISH_TEST_DEFAULT_MODEL, "gpt-realtime-2");
  assert.equal(REALTIME_ENGLISH_TEST_FALLBACK_MODEL, "gpt-realtime");
  assert.equal(session.type, "realtime");
  assert.equal(session.model, "gpt-realtime-2");
  assert.deepEqual(session.output_modalities, ["audio"]);
  assert.equal(session.audio.output.voice, "marin");
  assert.equal(session.audio.input.turn_detection.type, "semantic_vad");
  assert.equal(session.audio.input.turn_detection.create_response, false);
  assert.equal(session.audio.input.turn_detection.eagerness, "low");
  assert.equal(session.audio.input.turn_detection.interrupt_response, false);
  assert.equal(session.audio.input.transcription.model, "gpt-realtime-whisper");
  assert.equal(session.reasoning?.effort, "low");
  assert.match(session.instructions, /CEFR/i);
  assert.match(session.instructions, /Carreira USA/i);
  assert.match(session.instructions, /AI teacher/i);
  assert.match(session.instructions, /corporate/i);
  assert.match(session.instructions, /TOEFL-style/i);
  assert.match(session.instructions, /adaptive test plan/i);
  assert.match(session.instructions, /role-play/i);
  assert.match(session.instructions, /targeted follow-up/i);
  assert.match(session.instructions, /increase complexity/i);
  assert.match(session.instructions, /8 to 10 minutes/i);
  assert.match(session.instructions, /five short sections/i);
  assert.match(session.instructions, /operations must reset|new test/i);
  assert.match(session.instructions, /student cannot manually finish the assessment/i);
  assert.match(session.instructions, /polished human interviewer/i);
  assert.match(session.instructions, /Do not sound robotic/i);
  assert.match(session.instructions, /Allow brief thinking pauses/i);
  assert.match(session.instructions, /repetition or clarification|repeat or clarification/i);
  assert.match(session.instructions, /Ignore brief noises/i);
  assert.match(session.instructions, /Portuguese/i);
  assert.match(session.instructions, /Do not begin with only a generic name question/i);
});

test("isMeaningfulRealtimeStudentTranscript filters noise and short fragments", () => {
  assert.equal(isMeaningfulRealtimeStudentTranscript("um"), false);
  assert.equal(isMeaningfulRealtimeStudentTranscript("okay"), false);
  assert.equal(isMeaningfulRealtimeStudentTranscript("hmm"), false);
  assert.equal(isMeaningfulRealtimeStudentTranscript("keyboard"), false);
  assert.equal(
    isMeaningfulRealtimeStudentTranscript("I currently work as a project manager."),
    true
  );
});

test("buildRealtimeEnglishTestSession resumes from saved transcript context", () => {
  const session = buildRealtimeEnglishTestSession({
    language: "en",
    transcript: [
      { role: "examiner", text: "Tell me about your current role.", at: "2026-05-18T12:00:00.000Z" },
      { role: "student", text: "I work as a project manager.", at: "2026-05-18T12:00:10.000Z" },
    ],
  });

  assert.match(session.instructions, /Saved progress exists/i);
  assert.match(session.instructions, /do not restart the test/i);
  assert.match(session.instructions, /Student: I work as a project manager/i);
});

test("getRealtimeEnglishTestProgress requires staged student evidence before scoring", () => {
  const incomplete = getRealtimeEnglishTestProgress([
    { role: "student", text: "First answer", acceptedEvidence: true },
    {
      role: "student",
      text: "I am joking, skip this.",
      acceptedEvidence: false,
      issueType: "joking",
    },
    { role: "examiner", text: "Follow-up" },
  ]);

  assert.equal(incomplete.studentTurns, 1);
  assert.equal(incomplete.requiredStudentTurns, REALTIME_ENGLISH_TEST_REQUIRED_STUDENT_TURNS);
  assert.equal(incomplete.isCompleteEnough, false);

  const complete = getRealtimeEnglishTestProgress(
    Array.from({ length: REALTIME_ENGLISH_TEST_REQUIRED_STUDENT_TURNS }, (_, index) => ({
      role: "student" as const,
      text: `Answer ${index + 1}`,
      acceptedEvidence: true,
    }))
  );

  assert.equal(complete.isCompleteEnough, true);
  assert.equal(complete.remainingStudentTurns, 0);
});

test("getRealtimeEnglishTestProgress does not count unevaluated or rejected answers", () => {
  const progress = getRealtimeEnglishTestProgress([
    { role: "student", text: "A random short answer without evaluator decision." },
    {
      role: "student",
      text: "I do not want to answer this question.",
      acceptedEvidence: false,
      issueType: "refusal",
    },
  ]);

  assert.equal(progress.studentTurns, 0);
  assert.equal(progress.completedStageCount, 0);
  assert.equal(progress.isCompleteEnough, false);
});

test("normalizeRealtimeEnglishTranscript preserves per-stage evaluation metadata", () => {
  const transcript = normalizeRealtimeEnglishTranscript([
    {
      role: "student",
      text: " I managed a stakeholder escalation last quarter. ",
      at: "2026-05-18T12:00:00.000Z",
      acceptedEvidence: true,
      stageId: "behavioral",
      issueType: "valid",
      evaluationReason: "Substantive STAR-style answer.",
    },
    {
      role: "student",
      text: "haha next",
      acceptedEvidence: false,
      stageId: "workplace",
      issueType: "joking",
      evaluationReason: "Joking answer did not address the workplace role-play.",
    },
  ]);

  assert.deepEqual(transcript, [
    {
      role: "student",
      text: "I managed a stakeholder escalation last quarter.",
      at: "2026-05-18T12:00:00.000Z",
      acceptedEvidence: true,
      stageId: "behavioral",
      issueType: "valid",
      evaluationReason: "Substantive STAR-style answer.",
    },
    {
      role: "student",
      text: "haha next",
      at: transcript[1].at,
      acceptedEvidence: false,
      stageId: "workplace",
      issueType: "joking",
      evaluationReason: "Joking answer did not address the workplace role-play.",
    },
  ]);
});

test("normalizeRealtimeEnglishTurnEvaluation enforces the current stage decision shape", () => {
  const stage = REALTIME_ENGLISH_TEST_STAGES[2];

  const accepted = normalizeRealtimeEnglishTurnEvaluation(
    {
      acceptedEvidence: true,
      issueType: "off_topic",
      reason: "This should still be normalized as valid because acceptedEvidence is true.",
      examinerDirective: "Move forward.",
    },
    {
      studentAnswer: "I would tell the stakeholder that I understand the concern and propose two options.",
      stage,
    }
  );

  assert.deepEqual(accepted, {
    acceptedEvidence: true,
    stageId: "workplace",
    stageTitle: "Workplace role-play",
    issueType: "valid",
    reason: "This should still be normalized as valid because acceptedEvidence is true.",
    examinerDirective: "Move forward.",
  });

  const rejected = normalizeRealtimeEnglishTurnEvaluation(
    {
      acceptedEvidence: false,
      issueType: "joking",
      reason: "The student joked instead of answering the role-play.",
      examinerDirective: "Do not advance. Re-ask the role-play.",
    },
    {
      studentAnswer: "haha next",
      stage,
    }
  );

  assert.equal(rejected.acceptedEvidence, false);
  assert.equal(rejected.stageId, "workplace");
  assert.equal(rejected.issueType, "joking");
  assert.match(rejected.examinerDirective, /Do not advance/i);
});

test("normalizeRealtimeEnglishTurnEvaluation falls back to local meaningfulness when model output is invalid", () => {
  const stage = REALTIME_ENGLISH_TEST_STAGES[0];

  const accepted = normalizeRealtimeEnglishTurnEvaluation(
    {},
    {
      studentAnswer: "I work as an operations coordinator and I want to improve my English for U.S. interviews.",
      stage,
    }
  );
  assert.equal(accepted.acceptedEvidence, true);
  assert.equal(accepted.issueType, "valid");

  const rejected = normalizeRealtimeEnglishTurnEvaluation(
    {},
    {
      studentAnswer: "ok",
      stage,
    }
  );
  assert.equal(rejected.acceptedEvidence, false);
  assert.equal(rejected.issueType, "too_short");
});

test("buildEvaluatorUnavailableRealtimeTurnEvaluation never advances a section", () => {
  const stage = REALTIME_ENGLISH_TEST_STAGES[1];

  const evaluation = buildEvaluatorUnavailableRealtimeTurnEvaluation({
    studentAnswer: "I managed the project and improved the process.",
    stage,
  });

  assert.equal(evaluation.acceptedEvidence, false);
  assert.equal(evaluation.stageId, "behavioral");
  assert.equal(evaluation.issueType, "unclear");
  assert.match(evaluation.examinerDirective, /Do not advance/i);
  assert.match(evaluation.reason, /could not be validated/i);
});

test("getRealtimeEnglishTestModelCandidates normalizes GPT Realtime 2 aliases", () => {
  const original = process.env.OPENAI_REALTIME_ENGLISH_TEST_MODEL;
  process.env.OPENAI_REALTIME_ENGLISH_TEST_MODEL = "gpt-realtime-2.0";

  try {
    assert.deepEqual(getRealtimeEnglishTestModelCandidates(), [
      "gpt-realtime-2",
      "gpt-realtime",
    ]);
  } finally {
    if (original === undefined) {
      delete process.env.OPENAI_REALTIME_ENGLISH_TEST_MODEL;
    } else {
      process.env.OPENAI_REALTIME_ENGLISH_TEST_MODEL = original;
    }
  }
});

test("normalizeRealtimeEnglishUsage extracts realtime and chat token usage", () => {
  const realtimeUsage = normalizeRealtimeEnglishUsage({
    response: {
      usage: {
        input_tokens: 1000,
        output_tokens: 2000,
        total_tokens: 3000,
        input_token_details: {
          text_tokens: 400,
          audio_tokens: 600,
          cached_tokens: 100,
        },
        output_token_details: {
          text_tokens: 800,
          audio_tokens: 1200,
        },
      },
    },
  });

  assert.deepEqual(realtimeUsage, {
    inputTextTokens: 400,
    cachedInputTextTokens: 100,
    inputAudioTokens: 600,
    outputTextTokens: 800,
    outputAudioTokens: 1200,
    totalTokens: 3000,
  });

  const chatUsage = normalizeRealtimeEnglishUsage({
    usage: {
      prompt_tokens: 120,
      completion_tokens: 80,
      total_tokens: 200,
    },
  });

  assert.deepEqual(chatUsage, {
    inputTextTokens: 120,
    cachedInputTextTokens: 0,
    inputAudioTokens: 0,
    outputTextTokens: 80,
    outputAudioTokens: 0,
    totalTokens: 200,
  });
});

test("mergeRealtimeEnglishUsageTotals accumulates tokens and estimates internal cost", () => {
  const totals = mergeRealtimeEnglishUsageTotals(
    {
      inputTextTokens: 10,
      cachedInputTextTokens: 2,
      inputAudioTokens: 100,
      outputTextTokens: 20,
      outputAudioTokens: 200,
      totalTokens: 330,
    },
    {
      inputTextTokens: 5,
      cachedInputTextTokens: 1,
      inputAudioTokens: 600,
      outputTextTokens: 8,
      outputAudioTokens: 1200,
      totalTokens: 1814,
    }
  );

  assert.deepEqual(totals, {
    inputTextTokens: 15,
    cachedInputTextTokens: 3,
    inputAudioTokens: 700,
    outputTextTokens: 28,
    outputAudioTokens: 1400,
    totalTokens: 2144,
  });

  assert.equal(
    estimateRealtimeEnglishUsageCostUsd(totals, {
      inputTextUsdPerMillion: 0,
      cachedInputTextUsdPerMillion: 0,
      inputAudioUsdPerMillion: 32,
      outputTextUsdPerMillion: 0,
      outputAudioUsdPerMillion: 64,
    }),
    0.112
  );
});

test("realtime oral test reset only targets in-progress sessions", () => {
  assert.equal(canResetRealtimeEnglishTestStatus("IN_PROGRESS"), true);
  assert.equal(canResetRealtimeEnglishTestStatus("COMPLETED"), false);
  assert.equal(canResetRealtimeEnglishTestStatus("FAILED"), false);
  assert.equal(canResetRealtimeEnglishTestStatus("RESET"), false);

  const now = new Date("2026-05-18T15:00:00.000Z");
  assert.deepEqual(buildRealtimeEnglishResetUpdateData(now), {
    status: "RESET",
    failedAt: now,
    errorMessage: "Reset by operations. Student must start a new oral English test.",
  });
});

test("buildRealtimeSafetyIdentifier is deterministic and does not expose the raw customer id", () => {
  const id = "customer_123";
  const first = buildRealtimeSafetyIdentifier(id);
  const second = buildRealtimeSafetyIdentifier(id);

  assert.equal(first, second);
  assert.notEqual(first, id);
  assert.equal(first.length, 64);
  assert.match(first, /^hub_[a-f0-9]{60}$/);
});

test("normalizeRealtimeEnglishResult clamps scores and level values from model output", () => {
  const result = normalizeRealtimeEnglishResult({
    cefrLevel: "C9",
    displayLevel: "Superhuman",
    score: 130,
    fluencyScore: 4.2,
    pronunciationScore: -2,
    grammarScore: 7,
    vocabularyScore: "5",
    comprehensionScore: 6,
    summary: "  Clear enough for a pilot.  ",
    strengths: ["speaks in full sentences", 42, ""],
    focusAreas: ["past tense accuracy", null],
  });

  assert.deepEqual(result, {
    cefrLevel: "B1",
    displayLevel: "Intermediate",
    score: 100,
    fluencyScore: 4,
    pronunciationScore: 0,
    grammarScore: 7,
    vocabularyScore: 5,
    comprehensionScore: 6,
    summary: "Clear enough for a pilot.",
    strengths: ["speaks in full sentences"],
    focusAreas: ["past tense accuracy"],
  });
});

test("buildRealtimeEnglishConversationMetrics counts pace and fillers from student transcript", () => {
  const metrics = buildRealtimeEnglishConversationMetrics({
    durationSeconds: 120,
    transcript: [
      { role: "examiner", text: "Tell me about a challenge.", at: "2026-05-18T12:00:00.000Z" },
      {
        role: "student",
        text: "Um, I led a migration and, like, had to coordinate product and engineering.",
        at: "2026-05-18T12:00:10.000Z",
      },
      {
        role: "student",
        text: "I mean, the hardest part was stakeholder alignment, but we delivered on time.",
        at: "2026-05-18T12:00:30.000Z",
      },
    ],
  });

  assert.equal(metrics.studentTurns, 2);
  assert.equal(metrics.totalStudentWords > 10, true);
  assert.equal(metrics.avgWordsPerAnswer > 5, true);
  assert.equal(metrics.estimatedWordsPerMinute > 0, true);
  assert.equal(metrics.fillerWordCount >= 3, true);
  assert.equal(metrics.topFillerWords.some((item) => item.startsWith("um")), true);
});

test("buildRealtimeEnglishDeliveryAnalysis produces interviewer-style read", () => {
  const delivery = buildRealtimeEnglishDeliveryAnalysis({
    language: "en",
    result: {
      cefrLevel: "B2",
      score: 76,
      fluencyScore: 7,
      pronunciationScore: 7,
      grammarScore: 7,
      vocabularyScore: 8,
      comprehensionScore: 8,
    },
    conversationMetrics: {
      studentTurns: 5,
      totalStudentWords: 340,
      avgWordsPerAnswer: 68,
      estimatedWordsPerMinute: 145,
      fillerWordCount: 4,
      topFillerWords: ["um (2)", "like (2)"],
    },
  });

  assert.match(delivery.fillerWordAssessment, /filler/i);
  assert.match(delivery.paceAssessment, /pace/i);
  assert.match(delivery.toneAndPresence, /presence/i);
  assert.match(delivery.examinerRead, /competitive|readiness|credible|selective/i);
});
