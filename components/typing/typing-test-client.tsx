'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const VISIBLE_LINE_COUNT = 4;
const ESTIMATED_GLYPH_WIDTH = 19;

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
  const [typedText, setTypedText] = useState('');
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
    const saved = window.localStorage.getItem(storageKey);

    if (saved) {
      setTypedText(saved);
    }
  }, [attemptId]);

  useEffect(() => {
    const storageKey = `typing-attempt-${attemptId}`;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      window.localStorage.setItem(storageKey, typedText);
    }, 250);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [attemptId, typedText]);

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

  const elapsedSeconds = Math.max(0, Math.min(durationSeconds, Math.floor((nowMs - startedAtMs) / 1000)));
  const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);

  const normalizedReferenceText = useMemo(() => normalizeTypingText(referenceText), [referenceText]);
  const normalizedTypedText = useMemo(() => normalizeTypingText(typedText), [typedText]);

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
  const typedChars = useMemo(() => Array.from(typedText), [typedText]);
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
          typedTextRaw: typedText,
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
  }, [attemptId, backspaceCount, elapsedSeconds, pasteCount, router, typedText]);

  useEffect(() => {
    if (remainingSeconds === 0 && !submitLockRef.current) {
      void submitAttempt();
    }
  }, [remainingSeconds, submitAttempt]);

  function focusTypingArea() {
    hiddenInputRef.current?.focus();
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden pb-24 md:pb-28">
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <Badge variant="outline">{campaignName}</Badge>
        <span>{articleTitle}</span>
        <span>自动保存已开启</span>
      </div>

      <div
        ref={containerRef}
        onMouseDown={(event) => {
          event.preventDefault();
          focusTypingArea();
        }}
        className="relative flex min-h-0 flex-1 cursor-text items-center px-2 md:px-4"
      >
        <textarea
          ref={hiddenInputRef}
          value={typedText}
          onChange={(event) => setTypedText(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onPaste={() => setPasteCount((value) => value + 1)}
          onKeyDown={(event) => {
            if (event.key === 'Backspace') {
              setBackspaceCount((value) => value + 1);
            }
          }}
          className="absolute inset-0 h-full w-full resize-none opacity-0"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoFocus
        />

        <div className="w-full font-mono text-[1.45rem] leading-[1.9] tracking-[0.01em] text-zinc-400/60 md:text-[1.85rem] md:leading-[1.8]">
          {!isFocused && typedText.length === 0 ? (
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
                    'min-h-[3.2rem] whitespace-pre-wrap break-words',
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
                          'relative transition-colors',
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

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-2 md:px-4">
        <div className="pointer-events-auto w-full rounded-full border border-border bg-background/92 px-4 py-3 shadow-lg backdrop-blur md:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <FloatingMetric label="time" value={formatDurationSeconds(remainingSeconds)} accent />
              <FloatingMetric label="kpm" value={`${metrics.scoreKpm}`} />
              <FloatingMetric label="accuracy" value={`${metrics.accuracy}%`} />
              <FloatingMetric label="progress" value={`${metrics.progress}%`} />
              <FloatingMetric label="errors" value={`${metrics.charCountError}`} />
              <FloatingMetric label="backspace" value={`${backspaceCount}`} />
              <FloatingMetric label="paste" value={`${pasteCount}`} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onMouseDown={(event) => event.preventDefault()} onClick={focusTypingArea}>聚焦输入</Button>
              <Button type="button" size="sm" onMouseDown={(event) => event.preventDefault()} onClick={() => void submitAttempt()} disabled={submitting}>
                {submitting ? '提交中…' : '提交成绩'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatingMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn('rounded-full border border-border bg-muted/40 px-3 py-2 text-sm', accent && 'border-primary/30 bg-primary/8')}>
      <span className="mr-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <span className={cn('font-semibold', accent && 'text-primary')}>{value}</span>
    </div>
  );
}
