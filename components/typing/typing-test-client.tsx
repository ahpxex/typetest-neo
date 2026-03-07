'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { calculateStrictAccuracy, calculateTypingMetricsPrepared, normalizeTypingText } from '@/modules/typing-engine';
import { isDevelopment } from '@/lib/env';
import { ESTIMATED_GLYPH_WIDTH, TEXT_VIEWPORT_MAX_WIDTH, VISIBLE_LINE_COUNT, buildVisibleLines, getCurrentLineIndex } from '@/components/typing/line-layout';
import { TypingStatsBar } from '@/components/typing/typing-stats-bar';
import { TypingViewport } from '@/components/typing/typing-viewport';
import type { TypingTestClientProps } from '@/components/typing/types';

type HistoricalAccuracyStats = {
  inputCharCount: number;
  mistypedCharCount: number;
};

const EMPTY_HISTORICAL_ACCURACY_STATS: HistoricalAccuracyStats = {
  inputCharCount: 0,
  mistypedCharCount: 0,
};

function getTypingTextStorageKey(attemptId: number) {
  return `typing-attempt-${attemptId}`;
}

function getTypingStatsStorageKey(attemptId: number) {
  return `typing-attempt-stats-${attemptId}`;
}

function countSnapshotMistakes(referenceText: string, typedText: string) {
  const referenceChars = Array.from(referenceText);
  const typedChars = Array.from(typedText);
  let mistakeCount = 0;

  for (let index = 0; index < typedChars.length; index += 1) {
    if (typedChars[index] !== referenceChars[index]) {
      mistakeCount += 1;
    }
  }

  return mistakeCount;
}

function parseHistoricalAccuracyStats(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<HistoricalAccuracyStats>;
    const inputCharCount = Number.isFinite(parsed.inputCharCount)
      ? Math.max(0, Math.floor(parsed.inputCharCount ?? 0))
      : 0;
    const mistypedCharCount = Number.isFinite(parsed.mistypedCharCount)
      ? Math.max(0, Math.floor(parsed.mistypedCharCount ?? 0))
      : 0;

    return {
      inputCharCount,
      mistypedCharCount,
    } satisfies HistoricalAccuracyStats;
  } catch {
    return null;
  }
}

function getInsertedCharacterDelta(
  previousValue: string,
  nextValue: string,
  referenceChars: string[],
): HistoricalAccuracyStats {
  if (previousValue === nextValue) {
    return EMPTY_HISTORICAL_ACCURACY_STATS;
  }

  const previousChars = Array.from(previousValue);
  const nextChars = Array.from(nextValue);
  const sharedLength = Math.min(previousChars.length, nextChars.length);

  let start = 0;
  while (start < sharedLength && previousChars[start] === nextChars[start]) {
    start += 1;
  }

  let previousEnd = previousChars.length - 1;
  let nextEnd = nextChars.length - 1;

  while (
    previousEnd >= start
    && nextEnd >= start
    && previousChars[previousEnd] === nextChars[nextEnd]
  ) {
    previousEnd -= 1;
    nextEnd -= 1;
  }

  const insertedChars = nextChars.slice(start, nextEnd + 1);

  if (insertedChars.length === 0) {
    return EMPTY_HISTORICAL_ACCURACY_STATS;
  }

  let mistypedCharCount = 0;

  for (let offset = 0; offset < insertedChars.length; offset += 1) {
    const expectedChar = referenceChars[start + offset];

    if (insertedChars[offset] !== expectedChar) {
      mistypedCharCount += 1;
    }
  }

  return {
    inputCharCount: insertedChars.length,
    mistypedCharCount,
  };
}

export function TypingTestClient({
  attemptId,
  articleTitle,
  referenceText,
  durationSeconds,
  startedAt,
}: TypingTestClientProps) {
  const router = useRouter();
  const startedAtMs = new Date(startedAt).getTime();
  const submitLockRef = useRef(false);
  const hiddenInputRef = useRef<HTMLTextAreaElement | null>(null);
  const textMeasureRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const typedTextRef = useRef('');
  const historicalAccuracyStatsRef = useRef<HistoricalAccuracyStats>(EMPTY_HISTORICAL_ACCURACY_STATS);
  const initialTypedLengthRef = useRef(0);
  const hasTypedSinceMountRef = useRef(false);
  const [renderedText, setRenderedText] = useState('');
  const [historicalAccuracyStats, setHistoricalAccuracyStats] = useState<HistoricalAccuracyStats>(EMPTY_HISTORICAL_ACCURACY_STATS);
  const [backspaceCount, setBackspaceCount] = useState(0);
  const [pasteCount, setPasteCount] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [lineMeasure, setLineMeasure] = useState({
    width: 960,
    glyphWidth: ESTIMATED_GLYPH_WIDTH,
  });
  const [isLineMeasureReady, setIsLineMeasureReady] = useState(false);
  const [isDevTimerPaused, setIsDevTimerPaused] = useState(isDevelopment);
  const [devElapsedMs, setDevElapsedMs] = useState(0);
  const devResumeStartedAtRef = useRef<number | null>(null);

  const referenceChars = useMemo(() => Array.from(referenceText), [referenceText]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const storageKey = getTypingTextStorageKey(attemptId);
    const statsKey = getTypingStatsStorageKey(attemptId);
    const savedText = window.localStorage.getItem(storageKey) ?? '';
    const savedStats = parseHistoricalAccuracyStats(window.localStorage.getItem(statsKey));
    const fallbackStats = {
      inputCharCount: Array.from(savedText).length,
      mistypedCharCount: countSnapshotMistakes(referenceText, savedText),
    } satisfies HistoricalAccuracyStats;
    const nextHistoricalAccuracyStats = savedStats ?? fallbackStats;

    typedTextRef.current = savedText;
    historicalAccuracyStatsRef.current = nextHistoricalAccuracyStats;
    initialTypedLengthRef.current = Array.from(savedText).length;
    hasTypedSinceMountRef.current = false;
    setRenderedText(savedText);
    setHistoricalAccuracyStats(nextHistoricalAccuracyStats);
    setBackspaceCount(0);
    setPasteCount(0);
    setError(null);
    setSubmitting(false);

    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = savedText;
    }
  }, [attemptId, referenceText]);

  useEffect(() => {
    const storageKey = getTypingTextStorageKey(attemptId);
    const statsKey = getTypingStatsStorageKey(attemptId);

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      window.localStorage.setItem(storageKey, typedTextRef.current);
      window.localStorage.setItem(statsKey, JSON.stringify(historicalAccuracyStatsRef.current));
    }, 250);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [attemptId, historicalAccuracyStats.inputCharCount, historicalAccuracyStats.mistypedCharCount, renderedText]);

  useEffect(() => {
    hiddenInputRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!textMeasureRef.current) {
      return;
    }

    const measure = () => {
      const element = textMeasureRef.current;

      if (!element) {
        return;
      }

      const computedStyle = window.getComputedStyle(element);
      const probe = document.createElement('span');
      const sample = '0'.repeat(64);

      probe.textContent = sample;
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      probe.style.pointerEvents = 'none';
      probe.style.whiteSpace = 'pre';
      probe.style.fontFamily = computedStyle.fontFamily;
      probe.style.fontSize = computedStyle.fontSize;
      probe.style.fontWeight = computedStyle.fontWeight;
      probe.style.fontStyle = computedStyle.fontStyle;
      probe.style.letterSpacing = computedStyle.letterSpacing;

      element.appendChild(probe);
      const glyphWidth = Math.max(probe.getBoundingClientRect().width / sample.length, ESTIMATED_GLYPH_WIDTH);
      probe.remove();

      const width = Math.min(element.getBoundingClientRect().width, TEXT_VIEWPORT_MAX_WIDTH);

      setLineMeasure((current) => {
        if (Math.abs(current.width - width) < 0.5 && Math.abs(current.glyphWidth - glyphWidth) < 0.25) {
          return current;
        }

        return { width, glyphWidth };
      });
      setIsLineMeasureReady(true);
    };

    measure();

    const observer = new ResizeObserver(() => {
      measure();
    });

    observer.observe(textMeasureRef.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const elapsedMilliseconds = isDevelopment
    ? devElapsedMs + (isDevTimerPaused || devResumeStartedAtRef.current === null ? 0 : nowMs - devResumeStartedAtRef.current)
    : nowMs - startedAtMs;
  const elapsedSeconds = Math.max(0, Math.min(durationSeconds, Math.floor(elapsedMilliseconds / 1000)));
  const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);
  const displayRemainingSeconds = isDevelopment && isDevTimerPaused ? durationSeconds - Math.floor(devElapsedMs / 1000) : remainingSeconds;

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

  const typedChars = useMemo(() => Array.from(renderedText), [renderedText]);
  const currentCharIndex = Math.min(typedChars.length, Math.max(referenceChars.length - 1, 0));
  const estimatedCharsPerLine = Math.floor((lineMeasure.width - 8) / lineMeasure.glyphWidth);

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

  const baselineTypedCount = initialTypedLengthRef.current;
  const liveTypedCount = Math.max(0, typedChars.length - baselineTypedCount);
  const stabilizedDurationMs = Math.max(elapsedMilliseconds, 5000);
  const liveScoreKpm = !hasTypedSinceMountRef.current || elapsedMilliseconds <= 0
    ? 0
    : Math.round((liveTypedCount / stabilizedDurationMs) * 60000);
  const liveAccuracy = calculateStrictAccuracy(historicalAccuracyStats);

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
          inputCharCount: historicalAccuracyStatsRef.current.inputCharCount,
          mistypedCharCount: historicalAccuracyStatsRef.current.mistypedCharCount,
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

      window.localStorage.removeItem(getTypingTextStorageKey(attemptId));
      window.localStorage.removeItem(getTypingStatsStorageKey(attemptId));
      router.push(payload.redirectTo);
      router.refresh();
    } catch (submitError) {
      submitLockRef.current = false;
      setSubmitting(false);
      setError(submitError instanceof Error ? submitError.message : '成绩提交失败');
    }
  }, [attemptId, backspaceCount, elapsedSeconds, pasteCount, router]);

  useEffect(() => {
    if (!isDevelopment && remainingSeconds === 0 && !submitLockRef.current) {
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

  const toggleDevTimerPaused = useCallback(() => {
    if (!isDevelopment) {
      return;
    }

    if (isDevTimerPaused) {
      devResumeStartedAtRef.current = Date.now();
      setNowMs(Date.now());
      setIsDevTimerPaused(false);
      return;
    }

    if (devResumeStartedAtRef.current !== null) {
      const resumeStartedAt = devResumeStartedAtRef.current;
      setDevElapsedMs((value) => value + (Date.now() - resumeStartedAt));
      devResumeStartedAtRef.current = null;
    }

    setIsDevTimerPaused(true);
  }, [isDevTimerPaused]);

  const handleInputValue = useCallback((value: string) => {
    const previousValue = typedTextRef.current;
    const historicalAccuracyDelta = getInsertedCharacterDelta(previousValue, value, referenceChars);

    typedTextRef.current = value;

    if (historicalAccuracyDelta.inputCharCount > 0) {
      historicalAccuracyStatsRef.current = {
        inputCharCount: historicalAccuracyStatsRef.current.inputCharCount + historicalAccuracyDelta.inputCharCount,
        mistypedCharCount: historicalAccuracyStatsRef.current.mistypedCharCount + historicalAccuracyDelta.mistypedCharCount,
      };
    }

    const currentLength = Array.from(value).length;

    if (currentLength < initialTypedLengthRef.current) {
      initialTypedLengthRef.current = currentLength;
    }

    if (currentLength !== initialTypedLengthRef.current) {
      hasTypedSinceMountRef.current = true;
    }

    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      setRenderedText(typedTextRef.current);
      setHistoricalAccuracyStats(historicalAccuracyStatsRef.current);
    });
  }, [referenceChars]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden pb-24 md:pb-28">
      <TypingViewport
        articleTitle={articleTitle}
        renderedText={renderedText}
        isFocused={isFocused}
        typedChars={typedChars}
        currentCharIndex={currentCharIndex}
        visibleLines={visibleLines}
        isLineMeasureReady={isLineMeasureReady}
        hiddenInputRef={hiddenInputRef}
        textMeasureRef={textMeasureRef}
        onInputValue={handleInputValue}
        onBackspace={handleBackspace}
        onPaste={handlePaste}
        onFocusChange={setIsFocused}
        onFocusTypingArea={focusTypingArea}
      />

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      <TypingStatsBar
        displayRemainingSeconds={displayRemainingSeconds}
        scoreKpm={liveScoreKpm}
        accuracy={liveAccuracy}
        progress={metrics.progress}
        charCountError={metrics.charCountError}
        backspaceCount={backspaceCount}
        pasteCount={pasteCount}
        submitting={submitting}
        isDevTimerPaused={isDevTimerPaused}
        onSubmit={() => void submitAttempt()}
        onToggleTimer={toggleDevTimerPaused}
      />
    </div>
  );
}
