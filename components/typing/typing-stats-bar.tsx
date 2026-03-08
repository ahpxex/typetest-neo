'use client';

import { memo } from 'react';

import { Button } from '@/components/ui/button';
import { formatDurationSeconds } from '@/lib/format';
import { isDevelopment } from '@/lib/env';
import { cn } from '@/lib/utils';
import type { TypingStatsBarProps } from '@/components/typing/types';

function FloatingMetric({
  label,
  value,
  accent = false,
  interactive = false,
  onClick,
}: {
  label: string;
  value: string;
  accent?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}) {
  const Comp = interactive ? 'button' : 'div';

  return (
    <Comp
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'rounded-full border border-border bg-muted/40 px-3 py-2 text-sm',
        accent && 'border-primary/30 bg-primary/8',
        interactive && 'cursor-pointer transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
      )}
    >
      <span className="mr-2 text-xs font-medium tracking-[0.04em] text-muted-foreground">{label}</span>
      <span className={cn('font-semibold tabular-nums', accent && 'text-primary')}>{value}</span>
    </Comp>
  );
}

export const TypingStatsBar = memo(function TypingStatsBar({
  displayRemainingSeconds,
  scoreKpm,
  accuracy,
  progress,
  charCountError,
  backspaceCount,
  submitting,
  isDevTimerPaused,
  onSubmit,
  onToggleTimer,
}: TypingStatsBarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-2 md:px-4">
      <div className="pointer-events-auto inline-flex max-w-[min(100%,1100px)] flex-wrap items-center justify-center gap-2 rounded-full border border-border bg-background/92 px-3 py-3 shadow-lg backdrop-blur md:gap-3 md:px-4">
        <FloatingMetric
          label={isDevelopment && isDevTimerPaused ? '倒计时（暂停）' : '剩余时间'}
          value={formatDurationSeconds(displayRemainingSeconds)}
          accent
          interactive={isDevelopment}
          onClick={onToggleTimer}
        />
        <FloatingMetric label="速度" value={`${scoreKpm}`} />
        <FloatingMetric label="正确率" value={`${accuracy}%`} />
        <FloatingMetric label="进度" value={`${progress}%`} />
        <FloatingMetric label="错误" value={`${charCountError}`} />
        <FloatingMetric label="退格" value={`${backspaceCount}`} />
        <Button type="button" size="sm" className="rounded-full px-3 py-2 text-sm shadow-none" onMouseDown={(event) => event.preventDefault()} onClick={onSubmit} disabled={submitting}>
          {submitting ? '提交中…' : '提交成绩'}
        </Button>
      </div>
    </div>
  );
});
