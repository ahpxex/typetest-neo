'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { calculateTypingMetricsPrepared, normalizeTypingText } from '@/modules/typing-engine';
import { formatDurationSeconds } from '@/lib/format';
import { cn } from '@/lib/utils';

type TypingTestClientProps = {
  attemptId: number;
  articleTitle: string;
  campaignName: string;
  referenceText: string;
  durationSeconds: number;
  startedAt: string;
};

type LineSegment = {
  text: string;
  start: number;
  end: number;
};

type TypingViewportProps = {
  articleTitle: string;
  campaignName: string;
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

type TypingStatsBarProps = {
  remainingSeconds: number;
  scoreKpm: number;
  accuracy: number;
  progress: number;
  charCountError: number;
  backspaceCount: number;
  pasteCount: number;
  submitting: boolean;
  onSubmit: () => void;
};

const VISIBLE_LINE_COUNT = 4;
const ESTIMATED_GLYPH_WIDTH = 14;

function buildVisibleLines(referenceChars: string[], maxCharsPerLine: number) {
  const safeWidth = Math.max(12, maxCharsPerLine);
  const lines: LineSegment[] = [];

  let index = 0;

  while (index < referenceChars.length) {
    const lineStart = index;
    let lineLength = 0;
    let lastBreak = -1;

    while (index < referenceChars.length) {
      const character = referenceChars[index];

      if (character === '\n') {
        break;
      }

      lineLength += 1;
      if (character === ' ') {
        lastBreak = index;
      }

      if (lineLength > safeWidth) {
        if (lastBreak >= lineStart) {
          index = lastBreak + 1;
        }
        break;
      }

      index += 1;
    }

    if (index === lineStart) {
      lines.push({ text: '', start: lineStart, end: lineStart });
      index += 1;
      continue;
    }

    const lineEnd = Math.min(index, referenceChars.length);
    const lineText = referenceChars.slice(lineStart, lineEnd).join('').replace(/\s+$/g, '');
    lines.push({ text: lineText, start: lineStart, end: lineEnd });

    if (referenceChars[index] === '\n') {
      index += 1;
    }
  }

  return lines.length > 0 ? lines : [{ text: '', start: 0, end: 0 }];
}

function getCurrentLineIndex(lines: LineSegment[], currentCharIndex: number) {
  const resolvedIndex = lines.findIndex((line, index) => {
    const nextLineStart = lines[index + 1]?.start ?? Number.POSITIVE_INFINITY;
    return currentCharIndex >= line.start && currentCharIndex < nextLineStart;
  });

  if (resolvedIndex >= 0) {
    return resolvedIndex;
  }

  return Math.max(lines.length - 1, 0);
}

const TypingViewport = memo(function TypingViewport({
  articleTitle,
  campaignName,
  renderedText,
  isFocused,
  typedChars,
  currentCharIndex,
  visibleLines,
  hiddenInputRef,
  onInputValue,
  onBackspace,
  onPaste,
  onFocusChange,
  onFocusTypingArea,
}: TypingViewportProps) {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <Badge variant="outline">{campaignName}</Badge>
        <span>{articleTitle}</span>
        <span>自动保存已开启</span>
      </div>

      <div
        onMouseDown={(event) => {
          event.preventDefault();
          onFocusTypingArea();
        }}
        className="relative flex min-h-0 flex-1 cursor-text items-center px-2 md:px-4"
      >
        <textarea
          ref={hiddenInputRef}
          defaultValue={renderedText}
          onChange={(event) => onInputValue(event.target.value)}
          onFocus={() => onFocusChange(true)}
          onBlur={() => onFocusChange(false)}
          onPaste={onPaste}
          onKeyDown={(event) => {
            if (event.key === 'Backspace') {
              onBackspace();
            }
          }}
          className="absolute inset-0 h-full w-full resize-none opacity-0"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoFocus
        />

        <div className="mx-auto w-full max-w-[1400px] text-center font-mono text-[1.18rem] leading-[1.95] tracking-[0.01em] text-zinc-400/60 md:text-[1.55rem] md:leading-[1.85]">
          {!isFocused && renderedText.length === 0 ? (
            <div className="mb-8 text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
              点击文本区域开始输入
            </div>
          ) : null}

          <div className="space-y-3">
            {visibleLines.map((line, lineOffset) => {
              const isCurrentLine = lineOffset === 0;
              const lineChars = Array.from(line.text);

              return (
                <div
                  key={`${line.start}-${line.end}`}
                  className={cn(
                    'mx-auto min-h-[3.2rem] max-w-full whitespace-pre-wrap break-words text-center',
                    !isCurrentLine && 'opacity-65',
                  )}
                >
                  {lineChars.map((character, charIndex) => {
                    const absoluteIndex = line.start + charIndex;
                    const typedCharacter = typedChars[absoluteIndex];
                    const hasTyped = typedCharacter !== undefined;
                    const isActive = absoluteIndex === currentCharIndex;
                    const isCorrect = hasTyped && typedCharacter === character;
                    const isIncorrect = hasTyped && typedCharacter !== character;

                    return (
                      <span
                        key={`${absoluteIndex}-${character}`}
                        className={cn(
                          'relative',
                          isCorrect && 'text-foreground',
                          isIncorrect && 'bg-destructive/15 text-destructive',
                          isActive && 'bg-primary/12 text-foreground before:absolute before:bottom-0 before:left-0 before:h-[2px] before:w-full before:bg-primary',
                        )}
                      >
                        {character}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
});

const TypingStatsBar = memo(function TypingStatsBar({
  remainingSeconds,
  scoreKpm,
  accuracy,
  progress,
  charCountError,
  backspaceCount,
  pasteCount,
  submitting,
  onSubmit,
}: TypingStatsBarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-2 md:px-4">
      <div className="pointer-events-auto inline-flex max-w-[min(100%,1100px)] flex-wrap items-center justify-center gap-2 rounded-full border border-border bg-background/92 px-3 py-3 shadow-lg backdrop-blur md:gap-3 md:px-4">
        <FloatingMetric label="剩余时间" value={formatDurationSeconds(remainingSeconds)} accent />
        <FloatingMetric label="速度" value={`${scoreKpm}`} />
        <FloatingMetric label="正确率" value={`${accuracy}%`} />
        <FloatingMetric label="进度" value={`${progress}%`} />
        <FloatingMetric label="错误" value={`${charCountError}`} />
        <FloatingMetric label="退格" value={`${backspaceCount}`} />
        <FloatingMetric label="粘贴" value={`${pasteCount}`} />
        <Button type="button" size="sm" className="rounded-full px-4 shadow-none" onMouseDown={(event) => event.preventDefault()} onClick={onSubmit} disabled={submitting}>
          {submitting ? '提交中…' : '提交成绩'}
        </Button>
      </div>
    </div>
  );
});

export function TypingTestClient({
  attemptId,
  articleTitle,
  campaignName,
  referenceText,
  durationSeconds,
  startedAt,
}: TypingTestClientProps) {
  const router = useRouter();
  const startedAtMs = new Date(startedAt).getTime();
  const submitLockRef = useRef(false);
  const hiddenInputRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const typedTextRef = useRef('');
  const [renderedText, setRenderedText] = useState('');
  const [backspaceCount, setBackspaceCount] = useState(0);
  const [pasteCount, setPasteCount] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [containerWidth, setContainerWidth] = useState(960);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const storageKey = `typing-attempt-${attemptId}`;
    const saved = window.localStorage.getItem(storageKey) ?? '';
    typedTextRef.current = saved;
    setRenderedText(saved);

    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = saved;
    }
  }, [attemptId]);

  useEffect(() => {
    const storageKey = `typing-attempt-${attemptId}`;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      window.localStorage.setItem(storageKey, typedTextRef.current);
    }, 250);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [attemptId, renderedText]);

  useEffect(() => {
    hiddenInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const elapsedSeconds = Math.max(0, Math.min(durationSeconds, Math.floor((nowMs - startedAtMs) / 1000)));
  const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);

  const normalizedReferenceText = useMemo(() => normalizeTypingText(referenceText), [referenceText]);
  const normalizedTypedText = useMemo(() => normalizeTypingText(renderedText), [renderedText]);

  const metrics = useMemo(
    () =>
      calculateTypingMetricsPrepared({
        referenceText: normalizedReferenceText,
        typedText: normalizedTypedText,
        durationSeconds: Math.max(elapsedSeconds, 1),
      }),
    [elapsedSeconds, normalizedReferenceText, normalizedTypedText],
  );

  const referenceChars = useMemo(() => Array.from(referenceText), [referenceText]);
  const typedChars = useMemo(() => Array.from(renderedText), [renderedText]);
  const currentCharIndex = Math.min(typedChars.length, Math.max(referenceChars.length - 1, 0));
  const estimatedCharsPerLine = Math.floor((containerWidth - 24) / ESTIMATED_GLYPH_WIDTH);

  const lines = useMemo(
    () => buildVisibleLines(referenceChars, estimatedCharsPerLine),
    [estimatedCharsPerLine, referenceChars],
  );

  const currentLineIndex = useMemo(
    () => getCurrentLineIndex(lines, currentCharIndex),
    [currentCharIndex, lines],
  );

  const visibleLines = useMemo(
    () => lines.slice(currentLineIndex, currentLineIndex + VISIBLE_LINE_COUNT),
    [currentLineIndex, lines],
  );

  const submitAttempt = useCallback(async () => {
    if (submitLockRef.current) {
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          typedTextRaw: typedTextRef.current,
          durationSecondsUsed: elapsedSeconds,
          backspaceCount,
          pasteCount,
          clientMeta: {
            userAgent: navigator.userAgent,
            language: navigator.language,
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
            },
          },
        }),
      });

      const payload = (await response.json()) as { error?: string; redirectTo?: string };

      if (!response.ok || !payload.redirectTo) {
        throw new Error(payload.error ?? '成绩提交失败');
      }

      window.localStorage.removeItem(`typing-attempt-${attemptId}`);
      router.push(payload.redirectTo);
      router.refresh();
    } catch (submitError) {
      submitLockRef.current = false;
      setSubmitting(false);
      setError(submitError instanceof Error ? submitError.message : '成绩提交失败');
    }
  }, [attemptId, backspaceCount, elapsedSeconds, pasteCount, router]);

  useEffect(() => {
    if (remainingSeconds === 0 && !submitLockRef.current) {
      void submitAttempt();
    }
  }, [remainingSeconds, submitAttempt]);

  const focusTypingArea = useCallback(() => {
    hiddenInputRef.current?.focus();
  }, []);

  const handleBackspace = useCallback(() => {
    setBackspaceCount((value) => value + 1);
  }, []);

  const handlePaste = useCallback(() => {
    setPasteCount((value) => value + 1);
  }, []);

  const handleInputValue = useCallback((value: string) => {
    typedTextRef.current = value;

    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      setRenderedText(typedTextRef.current);
    });
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden pb-24 md:pb-28">
      <TypingViewport
        articleTitle={articleTitle}
        campaignName={campaignName}
        renderedText={renderedText}
        isFocused={isFocused}
        typedChars={typedChars}
        currentCharIndex={currentCharIndex}
        visibleLines={visibleLines}
        hiddenInputRef={hiddenInputRef}
        onInputValue={handleInputValue}
        onBackspace={handleBackspace}
        onPaste={handlePaste}
        onFocusChange={setIsFocused}
        onFocusTypingArea={focusTypingArea}
      />

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      <TypingStatsBar
        remainingSeconds={remainingSeconds}
        scoreKpm={metrics.scoreKpm}
        accuracy={metrics.accuracy}
        progress={metrics.progress}
        charCountError={metrics.charCountError}
        backspaceCount={backspaceCount}
        pasteCount={pasteCount}
        submitting={submitting}
        onSubmit={() => void submitAttempt()}
      />
    </div>
  );
}

function FloatingMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn('rounded-full border border-border bg-muted/40 px-3 py-2 text-sm', accent && 'border-primary/30 bg-primary/8')}>
      <span className="mr-2 text-xs font-medium tracking-[0.04em] text-muted-foreground">{label}</span>
      <span className={cn('font-semibold tabular-nums', accent && 'text-primary')}>{value}</span>
    </div>
  );
}
