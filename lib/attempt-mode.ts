export const attemptModeValues = ['practice', 'exam'] as const;

export type AttemptMode = (typeof attemptModeValues)[number];

export function getAttemptModeLabel(mode: AttemptMode) {
  return mode === 'practice' ? '练习' : '考试';
}
