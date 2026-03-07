export type TypingTestClientProps = {
  attemptId: number;
  articleTitle: string;
  referenceText: string;
  durationSeconds: number;
  startedAt: string;
};

export type LineSegment = {
  text: string;
  start: number;
  end: number;
};

export type TypingViewportProps = {
  articleTitle: string;
  renderedText: string;
  isFocused: boolean;
  typedChars: string[];
  currentCharIndex: number;
  visibleLines: LineSegment[];
  hiddenInputRef: React.RefObject<HTMLTextAreaElement | null>;
  onInputValue: (value: string) => void;
  onBackspace: () => void;
  onPaste: () => void;
  onFocusChange: (focused: boolean) => void;
  onFocusTypingArea: () => void;
};

export type TypingStatsBarProps = {
  displayRemainingSeconds: number;
  scoreKpm: number;
  accuracy: number;
  progress: number;
  charCountError: number;
  backspaceCount: number;
  pasteCount: number;
  submitting: boolean;
  isDevTimerPaused: boolean;
  onSubmit: () => void;
  onToggleTimer: () => void;
};
