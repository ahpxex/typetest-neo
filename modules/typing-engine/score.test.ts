import { describe, expect, it } from 'bun:test';

import { calculateTypingMetricsPrepared } from '@/modules/typing-engine/score';

describe('calculateTypingMetricsPrepared', () => {
  it('returns full accuracy when the final text matches the reference', () => {
    expect(calculateTypingMetricsPrepared({
      referenceText: 'abc',
      typedText: 'abc',
      durationSeconds: 60,
    })).toEqual({
      charCountTyped: 3,
      charCountCorrect: 3,
      charCountError: 0,
      accuracy: 100,
      scoreKpm: 3,
      progress: 100,
    });
  });

  it('counts only residual mismatches in the submitted text as errors', () => {
    const metrics = calculateTypingMetricsPrepared({
      referenceText: 'abcdef',
      typedText: 'abxdef',
      durationSeconds: 60,
    });

    expect(metrics.charCountCorrect).toBe(5);
    expect(metrics.charCountError).toBe(1);
    expect(metrics.accuracy).toBe(83.3);
    expect(metrics.progress).toBe(83.3);
  });

  it('treats extra trailing characters as final-text errors', () => {
    const metrics = calculateTypingMetricsPrepared({
      referenceText: 'abc',
      typedText: 'abcd',
      durationSeconds: 60,
    });

    expect(metrics.charCountCorrect).toBe(3);
    expect(metrics.charCountError).toBe(1);
    expect(metrics.accuracy).toBe(75);
    expect(metrics.progress).toBe(100);
  });
});
