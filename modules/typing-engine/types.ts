export type TypingMetrics = {
  charCountTyped: number;
  charCountCorrect: number;
  charCountError: number;
  accuracy: number;
  scoreKpm: number;
  progress: number;
};

export type ScoreInput = {
  referenceText: string;
  typedText: string;
  durationSeconds: number;
};
