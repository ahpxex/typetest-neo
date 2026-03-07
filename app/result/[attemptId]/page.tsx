import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { getAnySignedInUser } from '@/lib/auth/guards'
import { getAttemptDetail, getLeaderboard } from '@/lib/data/queries'
import { formatDateTime, formatDurationSeconds, formatKpm, formatPercent } from '@/lib/format'

export default async function ResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const [{ attemptId }, viewer] = await Promise.all([params, getAnySignedInUser()])
  const attempt = await getAttemptDetail(Number(attemptId))

  if (!attempt || !viewer) {
    redirect('/')
  }

  if (viewer.type === 'student' && viewer.student.id !== attempt.studentId) {
    redirect('/typing')
  }

  const leaderboard = await getLeaderboard()
  const overallRank = leaderboard.find((entry) => entry.attemptId === attempt.attemptId)?.rank

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 md:px-6">
      <div className="w-full max-w-4xl">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle>成绩摘要</CardTitle>
              <Badge variant={attempt.status === 'submitted' ? 'secondary' : attempt.status === 'invalidated' ? 'destructive' : 'outline'}>
                {attempt.status}
              </Badge>
            </div>
            <CardDescription>{attempt.articleTitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric title="速度" value={formatKpm(attempt.scoreKpm)} />
              <Metric title="正确率" value={formatPercent(attempt.accuracy)} />
              <Metric title="用时" value={formatDurationSeconds(attempt.durationSecondsUsed ?? attempt.durationSecondsAllocated)} />
              <Metric title="总榜排名" value={overallRank ? `#${overallRank}` : '未上榜'} />
            </div>

            <div className="grid gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground md:grid-cols-2">
              <p>学生：<span className="font-medium text-foreground">{attempt.studentName}</span>（{attempt.studentNo}）</p>
              <p>提交时间：<span className="font-medium text-foreground">{formatDateTime(attempt.submittedAt)}</span></p>
              <p>开始时间：<span className="font-medium text-foreground">{formatDateTime(attempt.startedAt)}</span></p>
              <p>字符统计：<span className="font-medium text-foreground">正确 {attempt.charCountCorrect} / 错误 {attempt.charCountError}</span></p>
            </div>

            {attempt.suspicionFlags.length > 0 ? (
              <Alert>
                <AlertTitle>风控提示</AlertTitle>
                <AlertDescription>{attempt.suspicionFlags.join('、')}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
          <CardFooter className="justify-center gap-3 border-t">
            <Button asChild variant="outline" className="min-w-32">
              <Link href="/ranking">查看排行榜</Link>
            </Button>
            <Button asChild variant="default" className="min-w-32">
              <Link href="/typing">重新测试</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}
