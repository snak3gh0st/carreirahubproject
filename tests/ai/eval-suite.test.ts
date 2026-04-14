import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GOLDEN_QUESTIONS } from '@/lib/ai/eval/golden-questions';
import { toolRegistry } from '@/lib/ai/tools';

describe('Golden eval suite — structural assertions', () => {
  it('covers all 4 domains + security', () => {
    const ids = GOLDEN_QUESTIONS.map(q => q.id);
    assert.ok(ids.some(id => id.startsWith('fin-')), 'has finance questions');
    assert.ok(ids.some(id => id.startsWith('stu-')), 'has students questions');
    assert.ok(ids.some(id => id.startsWith('lead-')), 'has leads questions');
    assert.ok(ids.some(id => id.startsWith('con-')), 'has contracts questions');
    assert.ok(ids.some(id => id.startsWith('sec-')), 'has security questions');
  });

  it('has at least 15 questions', () => {
    assert.ok(GOLDEN_QUESTIONS.length >= 15, `expected >= 15, got ${GOLDEN_QUESTIONS.length}`);
  });

  it('every expectedToolCall references a real tool in the registry', () => {
    const registryNames = new Set(toolRegistry.map(t => t.name));
    for (const q of GOLDEN_QUESTIONS) {
      for (const name of q.expectedToolCalls) {
        assert.ok(registryNames.has(name), `Question ${q.id} references unknown tool: ${name}`);
      }
    }
  });

  it('every question has at least one assertion', () => {
    for (const q of GOLDEN_QUESTIONS) {
      assert.ok(q.assertions.length > 0, `Question ${q.id} has no assertions`);
    }
  });
});
