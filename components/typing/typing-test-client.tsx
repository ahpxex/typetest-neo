'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { calculateTypingMetrics } from '@/modules/typing-engine';
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
  const activeCharRef = useRef<HTMLSpanElement | null>(null);
  const [typedText, setTypedText] = useState('');
  const [backspaceCount, setBackspaceCount] = useState(0);
  const [pasteCount, setPasteCount] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

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
    window.localStorage.setItem(storageKey, typedText);
  }, [attemptId, typedText]);

  useEffect(() => {
    hiddenInputRef.current?.focus();
  }, []);

  useEffect(() => {
    activeCharRef.current?.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: 'smooth',
    });
  }, [typedText]);

  const elapsedSeconds = Math.max(0, Math.min(durationSeconds, Math.floor((nowMs - startedAtMs) / 1000)));
  const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);

  const metrics = useMemo(
    () =>
      calculateTypingMetrics({
        referenceText,
        typedText,
        durationSeconds: Math.max(elapsedSeconds, 1),
      }),
    [elapsedSeconds, referenceText, typedText],
  );

  const referenceChars = useMemo(() => Array.from(referenceText), [referenceText]);
  const typedChars = useMemo(() => Array.from(typedText), [typedText]);
  const currentCharIndex = Math.min(typedChars.length, Math.max(referenceChars.length - 1, 0));

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
    <div className="relative pb-28 md:pb-32">
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <Badge variant="outline">{campaignName}</Badge>
        <span>{articleTitle}</span>
        <span>自动保存已开启</span>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={focusTypingArea}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            focusTypingArea();
          }
        }}
        className={cn(
          'group relative min-h-[420px] cursor-text rounded-[2rem] border px-6 py-8 transition-colors md:px-10 md:py-10',
          isFocused ? 'border-primary/40 bg-card shadow-sm' : 'border-border bg-card/70',
        )}
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
          className="pointer-events-none absolute inset-0 h-full w-full resize-none opacity-0"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />

        {!isFocused && typedText.length === 0 ? (
          <div className="pointer-events-none absolute inset-x-0 top-5 flex justify-center">
            <div className="rounded-full border border-border bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow-sm">
              点击文本区域开始输入
            </div>
          </div>
        ) : null}

        <div className="max-h-[520px] overflow-auto pr-2 text-[1.65rem] leading-[1.95] tracking-[0.01em] text-zinc-400/60 md:text-[2.15rem] md:leading-[1.8]">
          {referenceChars.map((character, index) => {
            const typedCharacter = typedChars[index];
            const hasTyped = typedCharacter !== undefined;
            const isActive = index === currentCharIndex;
            const isCorrect = hasTyped && typedCharacter === character;
            const isIncorrect = hasTyped && typedCharacter !== character;

            return (
              <span
                key={`${index}-${character}`}
                ref={isActive ? activeCharRef : null}
                className={cn(
                  'relative rounded-[4px] transition-colors',
                  isCorrect && 'text-foreground',
                  isIncorrect && 'bg-destructive/15 text-destructive',
                  isActive && 'bg-primary/12 text-foreground before:absolute before:bottom-0 before:left-0 before:h-[2px] before:w-full before:rounded-full before:bg-primary',
                  character === ' ' && 'mr-[0.18em]',
                  character === '\n' && 'block h-4 w-full',
                )}
              >
                {character === ' ' ? '\u00A0' : character === '\n' ? '' : character}
              </span>
            );
          })}
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
        <div className="pointer-events-auto w-full max-w-6xl rounded-full border border-border bg-background/90 px-4 py-3 shadow-lg backdrop-blur md:px-5">
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
              <Button type="button" variant="ghost" size="sm" onClick={focusTypingArea}>聚焦输入</Button>
              <Button type="button" size="sm" onClick={() => void submitAttempt()} disabled={submitting}>
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
