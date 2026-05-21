import assert from "node:assert/strict";
import test from "node:test";

import { A2_QUESTIONS } from "../../lib/hub/question-bank/questions-a2";
import { B1_QUESTIONS } from "../../lib/hub/question-bank/questions-b1";
import { B2_QUESTIONS } from "../../lib/hub/question-bank/questions-b2";
import { C1_QUESTIONS } from "../../lib/hub/question-bank/questions-c1";
import { C2_QUESTIONS } from "../../lib/hub/question-bank/questions-c2";

function getQuestion<T extends { id: string }>(questions: T[], id: string): T {
  const question = questions.find((item) => item.id === id);
  assert.ok(question, `Expected to find question ${id}`);
  return question!;
}

test("A2 content uses current workplace phrasing and fixes the second conditional key", () => {
  const shift = getQuestion(A2_QUESTIONS, "a2_vocab_03");
  assert.match(shift.question, /cover my shift/i);
  assert.equal(shift.correctIndex, 0);

  const followUp = getQuestion(A2_QUESTIONS, "a2_vocab_05");
  assert.match(followUp.question, /follow up next week/i);
  assert.equal(followUp.correctIndex, 0);

  const login = getQuestion(A2_QUESTIONS, "a2_vocab_07");
  assert.match(login.question, /log in to the portal/i);
  assert.equal(login.correctIndex, 0);

  const secondConditional = getQuestion(A2_QUESTIONS, "a2_gram_13");
  assert.equal(secondConditional.correctIndex, 1);
  assert.equal(secondConditional.options[1], "would call / were");
});

test("B1 and B2 content removes known ambiguous or outdated prompts", () => {
  const reportedSpeech = getQuestion(B1_QUESTIONS, "b1_gram_06");
  assert.match(reportedSpeech.question, /^"Yesterday, she said she/);

  const remoteInterview = getQuestion(B1_QUESTIONS, "b1_read_03");
  assert.match(remoteInterview.passage || "", /video/i);
  assert.match(remoteInterview.passage || "", /camera/i);

  const mixedConditional = getQuestion(B2_QUESTIONS, "b2_gram_06");
  assert.match(mixedConditional.question, /would be managing/i);
  assert.equal(mixedConditional.correctIndex, 1);

  const passive = getQuestion(B2_QUESTIONS, "b2_gram_13");
  assert.equal(passive.correctIndex, 1);
  assert.equal(passive.options[1], "to have been prepared");

  const formalMessage = getQuestion(B2_QUESTIONS, "b2_gram_15");
  assert.match(formalMessage.question, /professional message to a recruiter/i);

  const coverLetter = getQuestion(B2_QUESTIONS, "b2_read_03");
  assert.doesNotMatch(coverLetter.passage || "", /do not start the letter with "I"/i);
  assert.match(coverLetter.passage || "", /tailor it to the company and position/i);

  const offerSummary = getQuestion(B2_QUESTIONS, "b2_read_05");
  assert.match(offerSummary.passage || "", /offer summary/i);
  assert.doesNotMatch(offerSummary.passage || "", /30 days of paid vacation/i);
});

test("C1 and C2 advanced items focus on clarity and professional interpretation", () => {
  const c1Error = getQuestion(C1_QUESTIONS, "c1_errid_02");
  assert.match(c1Error.options[1] || "", /series of workshops were/i);

  const c2Modifier = getQuestion(C2_QUESTIONS, "c2_errid_01");
  assert.match(c2Modifier.question, /least clear/i);

  const c2Almost = getQuestion(C2_QUESTIONS, "c2_errid_02");
  assert.match(c2Almost.question, /\"almost\" changes the meaning/i);

  const c2Repetition = getQuestion(C2_QUESTIONS, "c2_vocab_04");
  assert.match(c2Repetition.question, /trying to achieve with this repetition/i);
  assert.equal(c2Repetition.correctIndex, 0);

  const c2Effect = getQuestion(C2_QUESTIONS, "c2_vocab_05");
  assert.match(c2Effect.question, /What effect does this phrasing create/i);
  assert.equal(c2Effect.correctIndex, 0);
});
