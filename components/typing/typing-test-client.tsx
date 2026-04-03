'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { calculateTypingMetricsPrepared, normalizeTypingText } from '@/modules/typing-engine';
import { isDevelopment } from '@/lib/env';
import { ESTIMATED_GLYPH_WIDTH, TEXT_VIEWPORT_MAX_WIDTH, VISIBLE_LINE_COUNT, buildVisibleLines, getCurrentLineIndex } from '@/components/typing/line-layout';
import { TypingStatsBar } from '@/components/typing/typing-stats-bar';
import { TypingViewport } from '@/components/typing/typing-viewport';
import type { TypingTestClientProps } from '@/components/typing/types';

function getTypingTextStorageKey(attemptId: number) {
  return `typing-attempt-${attemptId}`;
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
  const initialTypedLengthRef = useRef(0);
  const hasTypedSinceMountRef = useRef(false);
  const [renderedText, setRenderedText] = useState('');
  const [backspaceCount, setBackspaceCount] = useState(0);
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
    const savedText = window.localStorage.getItem(storageKey) ?? '';

    typedTextRef.current = savedText;
    initialTypedLengthRef.current = Array.from(savedText).length;
    hasTypedSinceMountRef.current = false;
    setRenderedText(savedText);
    setBackspaceCount(0);
    setError(null);
    setSubmitting(false);
    window.localStorage.removeItem(`typing-attempt-stats-${attemptId}`);

    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = savedText;
    }
  }, [attemptId, referenceText]);

  useEffect(() => {
    const storageKey = getTypingTextStorageKey(attemptId);

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
  const liveAccuracy = metrics.accuracy;

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
          backspaceCount,
          clientMeta: {
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
      window.localStorage.removeItem(`typing-attempt-stats-${attemptId}`);
      router.push(payload.redirectTo);
      router.refresh();
    } catch (submitError) {
      submitLockRef.current = false;
      setSubmitting(false);
      setError(submitError instanceof Error ? submitError.message : '成绩提交失败');
    }
  }, [attemptId, backspaceCount, router]);

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
    typedTextRef.current = value;

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
    });
  }, []);

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
        submitting={submitting}
        isDevTimerPaused={isDevTimerPaused}
        onSubmit={() => void submitAttempt()}
        onToggleTimer={toggleDevTimerPaused}
      />
    </div>
  );
}
