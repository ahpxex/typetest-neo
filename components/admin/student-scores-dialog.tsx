'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime, formatDurationSeconds, formatKpm, formatPercent } from '@/lib/format'
import type { AdminStudentAttemptSummary, AdminStudentSummary } from '@/lib/data/queries'

type AttemptResponse = {
  attempts: Array<{
    id: number;
    attemptNo: number;
    articleTitle: string;
    status: AdminStudentAttemptSummary['status'];
    scoreKpm: number;
    accuracy: number;
    startedAt: string;
    submittedAt: string | null;
    durationSecondsAllocated: number;
    durationSecondsUsed: number | null;
    suspicionFlags: string[];
  }>;
}

const REQUEST_TIMEOUT_MS = 10000
const attemptCache = new Map<string, AttemptResponse['attempts']>()
const attemptRequestCache = new Map<string, Promise<AttemptResponse['attempts']>>()

async function fetchStudentAttempts(studentNo: string) {
  const cachedAttempts = attemptCache.get(studentNo)

  if (cachedAttempts) {
    return cachedAttempts
  }

  const pendingRequest = attemptRequestCache.get(studentNo)

  if (pendingRequest) {
    return pendingRequest
  }

  const request = (async () => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      controller.abort('timeout')
    }, REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(studentNo)}/attempts`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      })
      const payload = await response.json() as AttemptResponse & { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? '成绩加载失败')
      }

      attemptCache.set(studentNo, payload.attempts)

      return payload.attempts
    } finally {
      window.clearTimeout(timer)
      attemptRequestCache.delete(studentNo)
    }
  })()

  attemptRequestCache.set(studentNo, request)

  return request
}

export function StudentScoresDialog({ student }: { student: AdminStudentSummary }) {
  const studentNo = student.studentNo
  const [open, setOpen] = useState(false)
  const [attempts, setAttempts] = useState<AttemptResponse['attempts'] | null>(() => attemptCache.get(studentNo) ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const currentStudentNoRef = useRef(studentNo)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    currentStudentNoRef.current = studentNo
    setAttempts(attemptCache.get(studentNo) ?? null)
    setLoading(false)
    setError(null)
  }, [studentNo])

  const loadAttempts = useCallback(async () => {
    if (loading) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const nextAttempts = await fetchStudentAttempts(studentNo)

      if (!mountedRef.current || currentStudentNoRef.current !== studentNo) {
        return
      }

      setAttempts(nextAttempts)
    } catch (loadError) {
      if (!mountedRef.current || currentStudentNoRef.current !== studentNo) {
        return
      }

      if (loadError instanceof DOMException && loadError.name === 'AbortError') {
        setError('成绩详情加载超时，请重试')
      } else {
        setError(loadError instanceof Error ? loadError.message : '成绩加载失败')
      }
    } finally {
      if (mountedRef.current && currentStudentNoRef.current === studentNo) {
        setLoading(false)
      }
    }
  }, [loading, studentNo])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)

    if (!nextOpen) {
      return
    }

    const cachedAttempts = attemptCache.get(studentNo)

    if (cachedAttempts) {
      setAttempts(cachedAttempts)
      setError(null)
      return
    }

    void loadAttempts()
  }, [loadAttempts, studentNo])

  const bestSpeed = useMemo(
    () => (student.bestSubmittedScoreKpm === null ? '—' : formatKpm(student.bestSubmittedScoreKpm)),
    [student.bestSubmittedScoreKpm],
  )
  const bestAccuracy = useMemo(
    () => (student.bestSubmittedAccuracy === null ? '—' : formatPercent(student.bestSubmittedAccuracy)),
    [student.bestSubmittedAccuracy],
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">查看成绩</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{student.name} · 成绩详情</DialogTitle>
          <DialogDescription>{student.studentNo} · {student.campusEmail}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard label="最佳速度" value={bestSpeed} />
          <MetricCard label="最佳准确率" value={bestAccuracy} />
          <MetricCard label="已提交次数" value={`${student.submittedAttemptCount}`} />
          <MetricCard label="总记录数" value={`${student.totalAttemptCount}`} />
        </div>

        {loading ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            正在加载成绩详情…
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-dashed border-destructive/40 px-4 py-10 text-center text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!loading && !error && attempts?.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            该学生还没有成绩记录。
          </div>
        ) : null}

        {!loading && !error && attempts && attempts.length > 0 ? (
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>次数</TableHead>
                  <TableHead>文章</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>速度</TableHead>
                  <TableHead>正确率</TableHead>
                  <TableHead>用时</TableHead>
                  <TableHead>提交时间</TableHead>
                  <TableHead>异常</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell>{attempt.attemptNo}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{attempt.articleTitle}</TableCell>
                    <TableCell>
                      <Badge variant={attempt.status === 'submitted' ? 'secondary' : 'outline'}>{attempt.status}</Badge>
                    </TableCell>
                    <TableCell>{attempt.status === 'submitted' ? formatKpm(attempt.scoreKpm) : '—'}</TableCell>
                    <TableCell>{attempt.status === 'submitted' ? formatPercent(attempt.accuracy) : '—'}</TableCell>
                    <TableCell>{attempt.durationSecondsUsed ? formatDurationSeconds(attempt.durationSecondsUsed) : formatDurationSeconds(attempt.durationSecondsAllocated)}</TableCell>
                    <TableCell>{formatDateTime(attempt.submittedAt ? new Date(attempt.submittedAt) : new Date(attempt.startedAt))}</TableCell>
                    <TableCell>
                      {attempt.suspicionFlags.length === 0 ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        <div className="space-y-1">
                          {attempt.suspicionFlags.map((flag) => (
                            <Badge key={flag} variant="outline">{flag}</Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}
