import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StudentPageShell } from '@/components/typing/student-page-shell';
import { requireStudent } from '@/lib/auth/guards';
import { getStudentCompetitionDetail } from '@/lib/data/queries';
import { getCompetitionPhaseLabel, isCompetitionJoinable } from '@/lib/competition';
import { formatDateTime, formatDurationSeconds, formatKpm, formatPercent } from '@/lib/format';

export default async function CompetitionDetailPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { student } = await requireStudent();
  const { competitionId } = await params;
  const id = Number(competitionId);

  if (!Number.isFinite(id) || id <= 0) {
    notFound();
  }

  const detail = await getStudentCompetitionDetail(id, student.id);

  if (!detail) {
    notFound();
  }

  const remainingAttempts = Math.max(0, detail.maxAttemptsPerStudent - detail.yourAttemptCount);
  const joinable = isCompetitionJoinable(detail.phase);
  const canStart = joinable && remainingAttempts > 0;

  const controls = (
    <>
      <Button asChild variant="outline" size="sm">
        <Link href="/competitions">全部竞赛</Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href="/typing">返回首页</Link>
      </Button>
    </>
  );

  return (
    <StudentPageShell
      studentName={student.name}
      title={detail.title}
      description={`文章：${detail.articleTitle}`}
      extraInfo={
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:justify-end">
          <Badge variant={detail.phase === 'open' ? 'secondary' : 'outline'}>{getCompetitionPhaseLabel(detail.phase)}</Badge>
          <span>时长 {formatDurationSeconds(detail.durationSeconds)}</span>
          <span>·</span>
          <span>每人 {detail.maxAttemptsPerStudent} 次</span>
        </div>
      }
      controls={controls}
    >
      <div className="flex min-h-0 flex-1 overflow-auto">
        <div className="mx-auto grid w-full max-w-5xl content-start gap-4 py-4 lg:grid-cols-[1fr_1.4fr] lg:items-start">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">竞赛信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {detail.description ? <p className="text-foreground">{detail.description}</p> : null}
                <p>开始时间：{detail.startAt ? formatDateTime(detail.startAt) : '已开放'}</p>
                <p>结束时间：{detail.endAt ? formatDateTime(detail.endAt) : '手动关闭前持续开放'}</p>
                <p>参与人数：{detail.participantCount} 人</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">我的成绩</CardTitle>
                <CardDescription>
                  {detail.yourBestScoreKpm === null
                    ? '你还没有在该竞赛提交成绩。'
                    : `最佳 ${formatKpm(detail.yourBestScoreKpm)} · ${formatPercent(detail.yourBestAccuracy ?? 0)}${detail.yourRank ? ` · 当前第 ${detail.yourRank} 名` : ''}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  已用 {detail.yourAttemptCount} / {detail.maxAttemptsPerStudent} 次，剩余 {remainingAttempts} 次。
                </p>

                {canStart ? (
                  <Button asChild className="w-full">
                    <Link href={`/competitions/${detail.id}/typing`}>
                      {detail.yourAttemptCount > 0 ? '再次参加' : '开始竞赛'}
                    </Link>
                  </Button>
                ) : (
                  <Button className="w-full" disabled>
                    {detail.phase === 'upcoming'
                      ? '竞赛尚未开始'
                      : !joinable
                        ? '竞赛已结束'
                        : '参加次数已用完'}
                  </Button>
                )}

                {detail.yourBestAttemptId ? (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/result/${detail.yourBestAttemptId}`}>查看我的最佳成绩</Link>
                  </Button>
                ) : null}

                {detail.yourAttempts.length > 0 ? (
                  <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-xs font-medium text-muted-foreground">我的参加记录</p>
                    {detail.yourAttempts.map((attempt) => (
                      <Link
                        key={attempt.attemptId}
                        href={`/result/${attempt.attemptId}`}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
                      >
                        <span>{formatDateTime(attempt.submittedAt ?? attempt.startedAt)}</span>
                        <span>
                          {attempt.status === 'submitted'
                            ? `${formatKpm(attempt.scoreKpm)} · ${formatPercent(attempt.accuracy)}`
                            : attempt.status}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card className="flex min-h-0 flex-col">
            <CardHeader>
              <CardTitle className="text-lg">竞赛成绩榜</CardTitle>
              <CardDescription>每位同学取本竞赛的最佳一次成绩排名。</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>排名</TableHead>
                      <TableHead>学生</TableHead>
                      <TableHead>速度</TableHead>
                      <TableHead>正确率</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.leaderboard.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                          还没有人提交成绩，快来抢占第一名。
                        </TableCell>
                      </TableRow>
                    ) : (
                      detail.leaderboard.map((entry) => (
                        <TableRow key={entry.attemptId} className={entry.studentId === student.id ? 'bg-muted/40' : ''}>
                          <TableCell className="font-semibold">#{entry.rank}</TableCell>
                          <TableCell>
                            <p className="font-medium">{entry.name}</p>
                            <p className="text-xs text-muted-foreground">{entry.studentNo}</p>
                          </TableCell>
                          <TableCell>{formatKpm(entry.scoreKpm)}</TableCell>
                          <TableCell>{formatPercent(entry.accuracy)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </StudentPageShell>
  );
}
