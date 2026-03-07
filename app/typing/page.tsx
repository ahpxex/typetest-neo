import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StudentPageShell } from '@/components/typing/student-page-shell';
import { requireStudent } from '@/lib/auth/guards';
import { getCurrentRotatingArticle, getStudentDashboard, type StudentRecentAttemptSummary } from '@/lib/data/queries';
import { formatDateTime, formatKpm, formatPercent } from '@/lib/format';
import { getAttemptModeLabel } from '@/lib/attempt-mode';

export default async function TypingHomePage() {
  const { student } = await requireStudent();
  const [dashboard, currentArticle] = await Promise.all([
    getStudentDashboard(student.id),
    getCurrentRotatingArticle(),
  ]);

  if (!dashboard) {
    return null;
  }

  return (
    <StudentPageShell
      studentName={student.name}
      title="打字训练中心"
      description="先练习，再开始正式考试。"
      extraInfo={
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:justify-end">
          <span>{dashboard.studentNo}</span>
          <span>·</span>
          <span>{dashboard.campusEmail}</span>
          <span>·</span>
          <span>{dashboard.enrollmentYear} 级</span>
          <span>·</span>
          <span>学院 {dashboard.schoolCode}</span>
          <span>·</span>
          <span>专业 {dashboard.majorCode}</span>
        </div>
      }
    >
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid min-h-0 gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>开始练习</CardTitle>
                <CardDescription>练习不会进入正式排行榜，可以随时继续。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                  <p>当前文章：{currentArticle?.title ?? '未设置'}</p>
                  <p className="mt-1">最佳练习成绩：{dashboard.bestPracticeScoreKpm === null ? '—' : `${formatKpm(dashboard.bestPracticeScoreKpm)} · ${formatPercent(dashboard.bestPracticeAccuracy ?? 0)}`}</p>
                </div>
                <Button asChild className="w-full">
                  <Link href="/typing/practice">开始练习</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>开始考试</CardTitle>
                <CardDescription>正式考试成绩会进入排行榜与后台统计。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                  <p>当前文章：{currentArticle?.title ?? '未设置'}</p>
                  <p className="mt-1">最佳考试成绩：{dashboard.bestExamScoreKpm === null ? '—' : `${formatKpm(dashboard.bestExamScoreKpm)} · ${formatPercent(dashboard.bestExamAccuracy ?? 0)}`}</p>
                </div>
                <Button asChild className="w-full">
                  <Link href="/typing/exam">开始考试</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid min-h-0 gap-4 md:grid-cols-2">
            <AttemptListCard title="最近练习记录" attempts={dashboard.practiceAttempts} />
            <AttemptListCard title="最近考试记录" attempts={dashboard.examAttempts} />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>当前状态</CardTitle>
            <CardDescription>登录信息、文章状态与快捷入口。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p>姓名：<span className="font-medium text-foreground">{dashboard.studentName}</span></p>
              <p className="mt-1">学号：<span className="font-medium text-foreground">{dashboard.studentNo}</span></p>
              <p className="mt-1">校园邮箱：<span className="font-medium text-foreground">{dashboard.campusEmail}</span></p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p>当前轮换文章：<span className="font-medium text-foreground">{currentArticle?.title ?? '未设置'}</span></p>
              <p className="mt-1">排行榜仅统计正式考试成绩。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline"><Link href="/ranking">查看排行榜</Link></Button>
              <Button asChild variant="outline"><Link href="/typing/practice">继续练习</Link></Button>
              <Button asChild variant="outline"><Link href="/typing/exam">进入考试</Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </StudentPageShell>
  );
}

function AttemptListCard({ title, attempts }: { title: string; attempts: StudentRecentAttemptSummary[] }) {
  return (
    <Card className="min-h-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{attempts.length === 0 ? '还没有记录。' : '点击可以查看成绩详情。'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 overflow-auto">
        {attempts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            暂无记录
          </div>
        ) : (
          attempts.map((attempt) => (
            <Link
              key={attempt.attemptId}
              href={`/result/${attempt.attemptId}`}
              className="block rounded-lg border border-border bg-muted/20 p-4 transition-colors hover:bg-muted/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{attempt.articleTitle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(attempt.submittedAt ?? attempt.startedAt)}</p>
                </div>
                <Badge variant={attempt.mode === 'exam' ? 'secondary' : 'outline'}>{getAttemptModeLabel(attempt.mode)}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span>状态：{attempt.status}</span>
                <span>速度：{attempt.status === 'submitted' ? formatKpm(attempt.scoreKpm) : '—'}</span>
                <span>正确率：{attempt.status === 'submitted' ? formatPercent(attempt.accuracy) : '—'}</span>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
