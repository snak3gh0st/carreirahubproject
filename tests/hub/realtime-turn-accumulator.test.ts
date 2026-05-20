import assert from "node:assert/strict";
import test from "node:test";

import { RealtimeTurnAccumulator } from "../../lib/hub/realtime-turn-accumulator";

function createFakeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { runAt: number; fn: () => void }>();

  return {
    setTimeout(fn: () => void, delayMs: number) {
      const id = nextId++;
      timers.set(id, { runAt: now + delayMs, fn });
      return id;
    },
    clearTimeout(id: number) {
      timers.delete(id);
    },
    advance(ms: number) {
      const target = now + ms;

      while (true) {
        const nextTimer = [...timers.entries()]
          .sort((a, b) => a[1].runAt - b[1].runAt)[0];

        if (!nextTimer || nextTimer[1].runAt > target) break;

        now = nextTimer[1].runAt;
        timers.delete(nextTimer[0]);
        nextTimer[1].fn();
      }

      now = target;
    },
  };
}

test("RealtimeTurnAccumulator merges resumed speech into a single finalized turn", () => {
  const finalized: string[] = [];
  const clock = createFakeClock();
  const accumulator = new RealtimeTurnAccumulator({
    graceMs: 1200,
    onFinalized: (text) => {
      finalized.push(text);
    },
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
  });

  accumulator.handleSpeechStarted();
  accumulator.pushTranscriptFragment("I led the migration.");
  accumulator.handleSpeechStopped();

  clock.advance(500);
  assert.deepEqual(finalized, []);

  accumulator.handleSpeechStarted();
  clock.advance(1500);
  assert.deepEqual(finalized, []);

  accumulator.pushTranscriptFragment("Then I aligned stakeholders across operations and finance.");
  accumulator.handleSpeechStopped();

  clock.advance(1199);
  assert.deepEqual(finalized, []);

  clock.advance(1);
  assert.deepEqual(finalized, [
    "I led the migration. Then I aligned stakeholders across operations and finance.",
  ]);
});

test("RealtimeTurnAccumulator does not finalize while speech is still active", () => {
  const finalized: string[] = [];
  const clock = createFakeClock();
  const accumulator = new RealtimeTurnAccumulator({
    graceMs: 800,
    onFinalized: (text) => {
      finalized.push(text);
    },
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
  });

  accumulator.handleSpeechStarted();
  accumulator.pushTranscriptFragment("I need a second to think.");
  clock.advance(2000);

  assert.deepEqual(finalized, []);

  accumulator.handleSpeechStopped();
  clock.advance(800);

  assert.deepEqual(finalized, ["I need a second to think."]);
});

test("RealtimeTurnAccumulator reset clears pending buffered speech", () => {
  const finalized: string[] = [];
  const clock = createFakeClock();
  const accumulator = new RealtimeTurnAccumulator({
    graceMs: 1000,
    onFinalized: (text) => {
      finalized.push(text);
    },
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
  });

  accumulator.handleSpeechStarted();
  accumulator.pushTranscriptFragment("This should not survive cleanup.");
  accumulator.handleSpeechStopped();
  accumulator.reset();
  clock.advance(2000);

  assert.deepEqual(finalized, []);
});
