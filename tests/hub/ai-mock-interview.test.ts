import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAiMockInterviewContext,
  summarizeAiMockInterviewContextForPrompt,
} from "../../lib/hub/ai-mock-interview-context";
import {
  AI_MOCK_INTERVIEW_DEFAULT_MODEL,
  AI_MOCK_INTERVIEW_FALLBACK_MODEL,
  buildAiMockInterviewConversationMetrics,
  buildAiMockInterviewFinalReportPrompt,
  buildAiMockInterviewOpeningPrompt,
  buildAiMockInterviewSession,
  countAiMockInterviewCandidateTurns,
  getAiMockInterviewModelCandidates,
  isMeaningfulAiMockInterviewCandidateTranscript,
  normalizeAiMockInterviewReport,
  normalizeAiMockInterviewTranscript,
} from "../../lib/hub/ai-mock-interview";

test("buildAiMockInterviewContext extracts CV-oriented onboarding profile", () => {
  const context = buildAiMockInterviewContext({
    customer: { name: "Marina Costa", email: "marina@example.com" },
    enrollment: {
      id: "enroll_1",
      programType: "PASS",
      currentPhase: { key: "ongoing", label: "Ongoing" },
    },
    englishLevel: { cefrLevel: "B2", displayLevel: "Intermediate", score: 82 },
    formAssignments: [
      {
        templateId: "onboarding-career",
        submission: {
          submittedAt: "2026-05-18T10:00:00.000Z",
          answers: {
            resume: "forms/customer/assignment/resume/Marina_Costa.pdf",
            desiredRole: "Product Operations Manager",
            linkedIn: "https://linkedin.com/in/marinacosta",
            workExperience: "Managed marketplace operations and cross-functional launches.",
          },
        },
      },
    ],
  });

  assert.equal(context.candidateName, "Marina Costa");
  assert.equal(context.targetRole, "Product Operations Manager");
  assert.equal(context.linkedinUrl, "https://linkedin.com/in/marinacosta");
  assert.deepEqual(context.resumeFiles, ["Marina_Costa.pdf"]);
  assert.equal(context.englishLevel, "B2 - Intermediate");

  const promptContext = summarizeAiMockInterviewContextForPrompt(context);
  assert.match(promptContext, /Product Operations Manager/i);
  assert.match(promptContext, /Uploaded resume\/CV files/i);
  assert.match(promptContext, /Managed marketplace operations/i);
});

test("buildAiMockInterviewSession configures a Realtime 2 mock interviewer", () => {
  const context = buildAiMockInterviewContext({
    customer: { name: "Renato Lima", email: "renato@example.com" },
    enrollment: {
      id: "enroll_1",
      programType: "ADVANCED",
      currentPhase: { key: "ongoing", label: "Ongoing" },
    },
    formAssignments: [],
  });
  const session = buildAiMockInterviewSession({ language: "pt-BR", context });

  assert.equal(AI_MOCK_INTERVIEW_DEFAULT_MODEL, "gpt-realtime-2");
  assert.equal(AI_MOCK_INTERVIEW_FALLBACK_MODEL, "gpt-realtime");
  assert.equal(session.type, "realtime");
  assert.equal(session.model, "gpt-realtime-2");
  assert.deepEqual(session.output_modalities, ["audio"]);
  assert.equal(session.audio.input.turn_detection.type, "semantic_vad");
  assert.equal(session.audio.input.turn_detection.create_response, false);
  assert.equal(session.audio.input.turn_detection.eagerness, "low");
  assert.equal(session.audio.input.turn_detection.interrupt_response, false);
  assert.equal(session.audio.input.transcription.model, "gpt-realtime-whisper");
  assert.equal(session.reasoning?.effort, "low");
  assert.match(session.instructions, /not an English placement test/i);
  assert.match(session.instructions, /realistic U\.S\. corporate job interview/i);
  assert.match(session.instructions, /CV\/resume context/i);
  assert.match(session.instructions, /Do not announce final scores/i);
  assert.match(session.instructions, /candidate's name, the interview duration, the areas you will cover/i);
  assert.match(session.instructions, /Sound like a real interviewer from a top U\.S\. company/i);
  assert.match(session.instructions, /Humanize the experience/i);
  assert.match(session.instructions, /CARL-first/i);
  assert.match(session.instructions, /context, action, result, and learning/i);
  assert.match(session.instructions, /STAR/i);
  assert.doesNotMatch(session.instructions, /behavioral STAR question/i);
});

test("getAiMockInterviewModelCandidates normalizes GPT Realtime 2 aliases", () => {
  const original = process.env.OPENAI_REALTIME_MOCK_INTERVIEW_MODEL;
  process.env.OPENAI_REALTIME_MOCK_INTERVIEW_MODEL = "gpt-realtime-2.0";

  try {
    assert.deepEqual(getAiMockInterviewModelCandidates(), [
      "gpt-realtime-2",
      "gpt-realtime",
    ]);
  } finally {
    if (original === undefined) {
      delete process.env.OPENAI_REALTIME_MOCK_INTERVIEW_MODEL;
    } else {
      process.env.OPENAI_REALTIME_MOCK_INTERVIEW_MODEL = original;
    }
  }
});

test("normalizeAiMockInterviewTranscript and filter ignore noise fragments", () => {
  const transcript = normalizeAiMockInterviewTranscript([
    { role: "interviewer", text: " Tell me about your background. ", at: "now" },
    { role: "candidate", text: " I led customer onboarding for a SaaS product. " },
    { role: "candidate", text: "" },
    { role: "student", text: "wrong role" },
  ]);

  assert.equal(transcript.length, 2);
  assert.equal(countAiMockInterviewCandidateTurns(transcript), 1);
  assert.equal(isMeaningfulAiMockInterviewCandidateTranscript("keyboard"), false);
  assert.equal(
    isMeaningfulAiMockInterviewCandidateTranscript("I managed stakeholder communication during a product launch."),
    true
  );
});

test("buildAiMockInterviewFinalReportPrompt and normalizer enforce coaching report shape", () => {
  const context = buildAiMockInterviewContext({
    customer: { name: "Camila Rocha", email: "camila@example.com" },
    formAssignments: [],
  });
  const prompt = buildAiMockInterviewFinalReportPrompt({
    language: "pt-BR",
    context,
    transcript: [
      { role: "interviewer", text: "Tell me about a conflict.", at: "now" },
      { role: "candidate", text: "I aligned finance and operations around a deadline.", at: "now" },
    ],
    durationSeconds: 120,
  });

  assert.match(prompt, /interview readiness/i);
  assert.match(prompt, /Portuguese/i);
  assert.match(prompt, /hiringSignal/i);
  assert.match(prompt, /deliveryAnalysis/i);

  const metrics = buildAiMockInterviewConversationMetrics({
    transcript: [
      { role: "candidate", text: "Um I led the kickoff and, like, aligned stakeholders." },
      { role: "candidate", text: "I mean, we closed the risk and delivered on time." },
    ],
    durationSeconds: 90,
  });

  const report = normalizeAiMockInterviewReport({
    overallScore: "84",
    communicationScore: 80.4,
    experienceScore: 87,
    problemSolvingScore: 78,
    roleFitScore: 85,
    executivePresenceScore: 79,
    hiringSignal: "promising",
    summary: "Strong base, needs tighter evidence.",
    strengths: ["Clear examples"],
    risks: ["Answers can be long"],
    focusAreas: ["Sharper STAR structure"],
    suggestedPracticeQuestions: ["Tell me about yourself."],
    deliveryAnalysis: {
      fillerWordAssessment: "Some filler words under pressure.",
      paceAssessment: "Slightly fast at transitions.",
      toneAndPresence: "Credible and composed overall.",
      interviewerRead: "Promising for mid-level interviews.",
    },
  }, metrics);

  assert.equal(report.overallScore, 84);
  assert.equal(report.communicationScore, 80);
  assert.equal(report.hiringSignal, "promising");
  assert.deepEqual(report.focusAreas, ["Sharper STAR structure"]);
  assert.equal(report.deliveryAnalysis.fillerWordAssessment, "Some filler words under pressure.");
  assert.equal(report.conversationMetrics.candidateTurns, 2);
  assert.equal(report.conversationMetrics.fillerWordCount > 0, true);
});

test("buildAiMockInterviewOpeningPrompt includes name, duration, areas, and CV grounding", () => {
  const context = buildAiMockInterviewContext({
    customer: { name: "Marina Costa", email: "marina@example.com" },
    formAssignments: [
      {
        templateId: "onboarding-career",
        submission: {
          answers: {
            resume: "forms/customer/assignment/resume/Marina_Costa.pdf",
            desiredRole: "Product Operations Manager",
          },
        },
      },
    ],
  });

  const prompt = buildAiMockInterviewOpeningPrompt({ context });
  assert.match(prompt, /Marina Costa/);
  assert.match(prompt, /10 to 12 minutes/);
  assert.match(prompt, /resume walkthrough, CARL behavioral evidence, role-specific scenarios/i);
  assert.match(prompt, /Marina_Costa\.pdf/);
});
