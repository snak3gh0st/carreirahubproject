import assert from "node:assert/strict";
import test from "node:test";

import { buildPlacementTestIncorrectReview } from "../../lib/hub/question-bank";

test("buildPlacementTestIncorrectReview returns only incorrect answers with question context", () => {
  const review = buildPlacementTestIncorrectReview(
    ["a1_gram_01", "a1_vocab_01_resume", "b1_read_01"],
    {
      a1_gram_01: 1,
      a1_vocab_01_resume: 0,
      b1_read_01: 3,
    }
  );

  assert.equal(review.length, 2);

  assert.deepEqual(
    review.map((item) => ({
      id: item.id,
      section: item.section,
      selectedOption: item.selectedOption,
      correctOption: item.correctOption,
    })),
    [
      {
        id: "a1_vocab_01_resume",
        section: 1,
        selectedOption: "To start again",
        correctOption: "A document listing your work experience and education",
      },
      {
        id: "b1_read_01",
        section: 3,
        selectedOption: "The working hours",
        correctOption: "How people introduced themselves",
      },
    ]
  );

  assert.match(review[1]?.passage || "", /Ana arrived at her new office/i);
});

test("buildPlacementTestIncorrectReview keeps unanswered questions in the review", () => {
  const review = buildPlacementTestIncorrectReview(["a1_gram_02"], {});

  assert.equal(review.length, 1);
  assert.equal(review[0]?.id, "a1_gram_02");
  assert.equal(review[0]?.selectedIndex, null);
  assert.equal(review[0]?.selectedOption, null);
  assert.equal(review[0]?.correctOption, "am");
});

test("buildPlacementTestIncorrectReview skips unknown question ids safely", () => {
  const review = buildPlacementTestIncorrectReview(["missing_question_id"], {
    missing_question_id: 2,
  });

  assert.deepEqual(review, []);
});
