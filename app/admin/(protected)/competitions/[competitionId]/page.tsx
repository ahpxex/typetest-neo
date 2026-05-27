import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireAdmin } from '@/lib/auth/guards'
import { getCompetitionForEditing, getCompetitionLeaderboard } from '@/lib/data/queries'
import {
  getCompetitionPhase,
  getCompetitionPhaseLabel,
  getCompetitionStatusLabel,
} from '@/lib/competition'
import { formatDateTime, formatKpm, formatPercent } from '@/lib/format'

export default async function AdminCompetitionDetailPage({
  params,
}: {
  params: Promise<{ competitionId: string }>
}) {
  await requireAdmin()
  const { competitionId } = await params
  const id = Number(competitionId)

  if (!Number.isFinite(id) || id <= 0) {
    notFound()
  }

  const competition = await getCompetitionForEditing(id)

  if (!competition) {
    notFound()
  }

  const leaderboard = await getCompetitionLeaderboard(id)
  const phase = getCompetitionPhase(competition)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{competition.title}</h1>
            <Badge variant="secondary">{getCompetitionStatusLabel(competition.status)}</Badge>
            {competition.status === 'published' ? (
              <Badge variant="outline">{getCompetitionPhaseLabel(phase)}</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">文章：{competition.articleTitleSnapshot}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/competitions">返回竞赛列表</Link>
        </Button>
      </header>

      <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="时长" value={`${competition.durationSeconds} 秒`} />
        <MetricCard label="每人次数" value={`${competition.maxAttemptsPerStudent} 次`} />
        <MetricCard label="上榜人数" value={`${leaderboard.length} 人`} />
        <MetricCard
          label="最佳成绩"
          value={leaderboard[0] ? formatKpm(leaderboard[0].scoreKpm) : '—'}
        />
      </div>

      <Card className="shrink-0">
        <CardContent className="grid gap-2 py-4 text-sm text-muted-foreground md:grid-cols-2">
          <p>开始时间：{competition.startAt ? formatDateTime(competition.startAt) : '开启即开始'}</p>
          <p>结束时间：{competition.endAt ? formatDateTime(competition.endAt) : '手动关闭前持续开放'}</p>
          {competition.description ? <p className="md:col-span-2">说明：{competition.description}</p> : null}
        </CardContent>
      </Card>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardHeader className="shrink-0">
          <CardTitle>竞赛成绩榜</CardTitle>
          <CardDescription>每位学生取本竞赛内的最佳一次成绩排名。</CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>排名</TableHead>
                  <TableHead>学生</TableHead>
                  <TableHead>速度</TableHead>
                  <TableHead>正确率</TableHead>
                  <TableHead>提交时间</TableHead>
                  <TableHead>成绩</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      还没有学生提交成绩。
                    </TableCell>
                  </TableRow>
                ) : (
                  leaderboard.map((entry) => (
                    <TableRow key={entry.attemptId}>
                      <TableCell className="font-semibold">#{entry.rank}</TableCell>
                      <TableCell>
                        <p className="font-medium">{entry.name}</p>
                        <p className="text-xs text-muted-foreground">{entry.studentNo} · {entry.campusEmail}</p>
                      </TableCell>
                      <TableCell>{formatKpm(entry.scoreKpm)}</TableCell>
                      <TableCell>{formatPercent(entry.accuracy)}</TableCell>
                      <TableCell>{formatDateTime(entry.submittedAt)}</TableCell>
                      <TableCell>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/result/${entry.attemptId}`}>查看</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
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
