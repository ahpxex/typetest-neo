export const attemptModeValues = ['practice', 'exam', 'competition'] as const;

export type AttemptMode = (typeof attemptModeValues)[number];

const attemptModeLabels: Record<AttemptMode, string> = {
  practice: '练习',
  exam: '考试',
  competition: '竞赛',
};

export function getAttemptModeLabel(mode: AttemptMode) {
  return attemptModeLabels[mode] ?? mode;
}
