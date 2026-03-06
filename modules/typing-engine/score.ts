import { normalizeTypingText } from '@/modules/typing-engine/normalize';
import type { ScoreInput, TypingMetrics } from '@/modules/typing-engine/types';

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

export function calculateTypingMetrics({
  referenceText,
  typedText,
  durationSeconds,
}: ScoreInput): TypingMetrics {
  const reference = normalizeTypingText(referenceText);
  const typed = normalizeTypingText(typedText);

  const referenceChars = Array.from(reference);
  const typedChars = Array.from(typed);
  const maxLength = Math.max(referenceChars.length, typedChars.length);

  let charCountCorrect = 0;
  let charCountError = 0;

  for (let index = 0; index < maxLength; index += 1) {
    const referenceChar = referenceChars[index];
    const typedChar = typedChars[index];

    if (referenceChar === undefined && typedChar !== undefined) {
      charCountError += 1;
      continue;
    }

    if (typedChar === undefined) {
      continue;
    }

    if (referenceChar === typedChar) {
      charCountCorrect += 1;
    } else {
      charCountError += 1;
    }
  }

  const charCountTyped = typedChars.length;
  const accuracy = charCountTyped === 0 ? 0 : (charCountCorrect / charCountTyped) * 100;
  const safeDurationSeconds = Math.max(durationSeconds, 1);
  const scoreKpm = (charCountCorrect / safeDurationSeconds) * 60;
  const progress = referenceChars.length === 0 ? 0 : Math.min(charCountCorrect / referenceChars.length, 1);

  return {
    charCountTyped,
    charCountCorrect,
    charCountError,
    accuracy: round(accuracy, 1),
    scoreKpm: round(scoreKpm, 0),
    progress: round(progress * 100, 1),
  };
}
