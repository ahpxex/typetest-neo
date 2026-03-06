'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { calculateTypingMetrics } from '@/modules/typing-engine';
import { formatDurationSeconds } from '@/lib/format';

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
  const [typedText, setTypedText] = useState('');
  const [backspaceCount, setBackspaceCount] = useState(0);
  const [pasteCount, setPasteCount] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <header className="space-y-2 border-b border-zinc-100 pb-4">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-zinc-400">Typing Test</p>
          <h1 className="text-2xl font-semibold text-zinc-950">{articleTitle}</h1>
          <p className="text-sm text-zinc-500">当前场次：{campaignName}</p>
        </header>

        <div className="rounded-2xl bg-zinc-50 p-4 text-base leading-8 text-zinc-700">
          {referenceText}
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-700">请输入全文</span>
          <textarea
            value={typedText}
            onChange={(event) => setTypedText(event.target.value)}
            onPaste={() => setPasteCount((value) => value + 1)}
            onKeyDown={(event) => {
              if (event.key === 'Backspace') {
                setBackspaceCount((value) => value + 1);
              }
            }}
            className="min-h-[280px] w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-7 text-zinc-900 outline-none transition focus:border-zinc-900"
            placeholder="从这里开始输入…"
            spellCheck={false}
            autoFocus
          />
        </label>

        {error ? <div className="text-sm text-rose-600">{error}</div> : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void submitAttempt()}
            disabled={submitting}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? '提交中…' : '提交成绩'}
          </button>
          <div className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-500">
            自动保存到本地草稿
          </div>
        </div>
      </section>

      <aside className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-950">实时统计</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <StatCard label="剩余时间" value={formatDurationSeconds(remainingSeconds)} highlight />
          <StatCard label="当前速度" value={`${metrics.scoreKpm} KPM`} />
          <StatCard label="正确率" value={`${metrics.accuracy}%`} />
          <StatCard label="进度" value={`${metrics.progress}%`} />
          <StatCard label="输入字符" value={String(metrics.charCountTyped)} />
          <StatCard label="正确字符" value={String(metrics.charCountCorrect)} />
          <StatCard label="错误字符" value={String(metrics.charCountError)} />
          <StatCard label="退格次数" value={String(backspaceCount)} />
          <StatCard label="粘贴次数" value={String(pasteCount)} />
          <StatCard label="已用时长" value={formatDurationSeconds(elapsedSeconds)} />
        </dl>
      </aside>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${highlight ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-zinc-50 text-zinc-900'}`}>
      <dt className={`text-xs ${highlight ? 'text-zinc-300' : 'text-zinc-500'}`}>{label}</dt>
      <dd className="mt-2 text-lg font-semibold">{value}</dd>
    </div>
  );
}
