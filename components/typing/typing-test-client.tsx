'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { calculateTypingMetrics } from '@/modules/typing-engine'
import { formatDurationSeconds } from '@/lib/format'
import { cn } from '@/lib/utils'

type TypingTestClientProps = {
  attemptId: number
  articleTitle: string
  campaignName: string
  referenceText: string
  durationSeconds: number
  startedAt: string
}

export function TypingTestClient({
  attemptId,
  articleTitle,
  campaignName,
  referenceText,
  durationSeconds,
  startedAt,
}: TypingTestClientProps) {
  const router = useRouter()
  const startedAtMs = new Date(startedAt).getTime()
  const submitLockRef = useRef(false)
  const hiddenInputRef = useRef<HTMLTextAreaElement | null>(null)
  const activeCharRef = useRef<HTMLSpanElement | null>(null)
  const [typedText, setTypedText] = useState('')
  const [backspaceCount, setBackspaceCount] = useState(0)
  const [pasteCount, setPasteCount] = useState(0)
  const [nowMs, setNowMs] = useState(Date.now())
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 250)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const storageKey = `typing-attempt-${attemptId}`
    const saved = window.localStorage.getItem(storageKey)

    if (saved) {
      setTypedText(saved)
    }
  }, [attemptId])

  useEffect(() => {
    const storageKey = `typing-attempt-${attemptId}`
    window.localStorage.setItem(storageKey, typedText)
  }, [attemptId, typedText])

  useEffect(() => {
    hiddenInputRef.current?.focus()
  }, [])

  useEffect(() => {
    activeCharRef.current?.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: 'smooth',
    })
  }, [typedText])

  const elapsedSeconds = Math.max(0, Math.min(durationSeconds, Math.floor((nowMs - startedAtMs) / 1000)))
  const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds)

  const metrics = useMemo(
    () =>
      calculateTypingMetrics({
        referenceText,
        typedText,
        durationSeconds: Math.max(elapsedSeconds, 1),
      }),
    [elapsedSeconds, referenceText, typedText],
  )

  const referenceChars = useMemo(() => Array.from(referenceText), [referenceText])
  const typedChars = useMemo(() => Array.from(typedText), [typedText])
  const currentCharIndex = Math.min(typedChars.length, Math.max(referenceChars.length - 1, 0))

  const submitAttempt = useCallback(async () => {
    if (submitLockRef.current) {
      return
    }

    submitLockRef.current = true
    setSubmitting(true)
    setError(null)

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
      })

      const payload = (await response.json()) as { error?: string; redirectTo?: string }

      if (!response.ok || !payload.redirectTo) {
        throw new Error(payload.error ?? '成绩提交失败')
      }

      window.localStorage.removeItem(`typing-attempt-${attemptId}`)
      router.push(payload.redirectTo)
      router.refresh()
    } catch (submitError) {
      submitLockRef.current = false
      setSubmitting(false)
      setError(submitError instanceof Error ? submitError.message : '成绩提交失败')
    }
  }, [attemptId, backspaceCount, elapsedSeconds, pasteCount, router, typedText])

  useEffect(() => {
    if (remainingSeconds === 0 && !submitLockRef.current) {
      void submitAttempt()
    }
  }, [remainingSeconds, submitAttempt])

  function focusTypingArea() {
    hiddenInputRef.current?.focus()
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="outline">{campaignName}</Badge>
          <span>{articleTitle}</span>
          <span>自动保存已开启</span>
        </div>

        <Card className="border-none bg-transparent shadow-none">
          <CardHeader className="px-0 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">time</p>
                  <p className="text-3xl font-semibold tracking-tight text-primary">{formatDurationSeconds(remainingSeconds)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">kpm</p>
                  <p className="text-xl font-semibold">{metrics.scoreKpm}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">accuracy</p>
                  <p className="text-xl font-semibold">{metrics.accuracy}%</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={focusTypingArea}>聚焦输入</Button>
                <Button type="button" onClick={() => void submitAttempt()} disabled={submitting}>{submitting ? '提交中…' : '提交成绩'}</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            <div
              role="button"
              tabIndex={0}
              onClick={focusTypingArea}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  focusTypingArea()
                }
              }}
              className={cn(
                'group relative min-h-[360px] cursor-text rounded-3xl border px-6 py-8 transition-colors md:px-8 md:py-10',
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
                    setBackspaceCount((value) => value + 1)
                  }
                }}
                className="pointer-events-none absolute inset-0 h-full w-full resize-none opacity-0"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />

              {!isFocused && typedText.length === 0 ? (
                <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
                  <div className="rounded-full border border-border bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow-sm">
                    点击文本区域开始输入
                  </div>
                </div>
              ) : null}

              <div className="max-h-[420px] overflow-auto pr-2 text-[1.6rem] leading-[1.9] tracking-[0.01em] md:text-[2rem] md:leading-[1.7]">
                {referenceChars.map((character, index) => {
                  const typedCharacter = typedChars[index]
                  const hasTyped = typedCharacter !== undefined
                  const isActive = index === currentCharIndex
                  const isCorrect = hasTyped && typedCharacter === character
                  const isIncorrect = hasTyped && typedCharacter !== character

                  return (
                    <span
                      key={`${index}-${character}`}
                      ref={isActive ? activeCharRef : null}
                      className={cn(
                        'relative rounded-[4px] transition-colors',
                        !hasTyped && 'text-zinc-400/55',
                        isCorrect && 'text-foreground',
                        isIncorrect && 'bg-destructive/15 text-destructive',
                        isActive && 'bg-primary/12 text-foreground before:absolute before:bottom-0 before:left-0 before:h-[2px] before:w-full before:rounded-full before:bg-primary',
                        character === ' ' && 'mr-[0.18em]',
                        character === '\n' && 'block h-4 w-full',
                      )}
                    >
                      {character === ' ' ? '\u00A0' : character === '\n' ? '' : character}
                    </span>
                  )
                })}
              </div>
            </div>

            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm xl:sticky xl:top-24 xl:h-fit">
        <h2 className="text-lg font-semibold">实时统计</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm xl:grid-cols-1">
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
  )
}

function StatCard({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn('rounded-2xl border px-4 py-3', highlight ? 'border-primary/30 bg-primary/8 text-foreground' : 'border-border bg-muted/30')}>
      <dt className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</dt>
      <dd className="mt-2 text-lg font-semibold">{value}</dd>
    </div>
  )
}
