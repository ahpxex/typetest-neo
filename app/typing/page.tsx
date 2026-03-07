import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StudentPageShell } from '@/components/typing/student-page-shell';
import { requireStudent } from '@/lib/auth/guards';
import { getCurrentRotatingArticle, getStudentDashboard, type StudentRecentAttemptSummary } from '@/lib/data/queries';
import { formatDateTime, formatKpm, formatPercent } from '@/lib/format';
import { getAttemptModeLabel, type AttemptMode } from '@/lib/attempt-mode';

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
      <div className="flex min-h-0 flex-1 overflow-auto">
        <div className="mx-auto grid w-full max-w-5xl content-start gap-6 py-4 xl:grid-cols-2 xl:items-start">
          <ModeCard
          title="练习"
          description="练习不会进入正式排行榜，可以随时继续。"
          href="/typing/practice"
          actionLabel="开始练习"
          bestLabel="最佳练习成绩"
          bestScore={dashboard.bestPracticeScoreKpm}
          bestAccuracy={dashboard.bestPracticeAccuracy}
          currentArticleTitle={currentArticle?.title ?? '未设置'}
          attempts={dashboard.practiceAttempts}
          mode="practice"
        />
          <ModeCard
            title="考试"
            description="正式考试成绩会进入排行榜与后台统计。"
            href="/typing/exam"
            actionLabel="开始考试"
            bestLabel="最佳考试成绩"
            bestScore={dashboard.bestExamScoreKpm}
            bestAccuracy={dashboard.bestExamAccuracy}
            currentArticleTitle={currentArticle?.title ?? '未设置'}
            attempts={dashboard.examAttempts}
            mode="exam"
          />
        </div>
      </div>
    </StudentPageShell>
  );
}

type ModeCardProps = {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  bestLabel: string;
  bestScore: number | null;
  bestAccuracy: number | null;
  currentArticleTitle: string;
  attempts: StudentRecentAttemptSummary[];
  mode: AttemptMode;
};

function ModeCard({
  title,
  description,
  href,
  actionLabel,
  bestLabel,
  bestScore,
  bestAccuracy,
  currentArticleTitle,
  attempts,
  mode,
}: ModeCardProps) {
  return (
    <Card className="w-full self-start overflow-hidden shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <Badge variant={mode === 'exam' ? 'secondary' : 'outline'}>{getAttemptModeLabel(mode)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <p>当前文章：{currentArticleTitle}</p>
          <p className="mt-1">
            {bestLabel}：{bestScore === null ? '—' : `${formatKpm(bestScore)} · ${formatPercent(bestAccuracy ?? 0)}`}
          </p>
        </div>

        <Button asChild className="w-full shrink-0">
          <Link href={href}>{actionLabel}</Link>
        </Button>

        <div className="min-h-0 flex-1 space-y-3 overflow-auto">
          <div>
            <p className="font-medium">最近记录</p>
            <p className="text-sm text-muted-foreground">
              {attempts.length === 0 ? '还没有记录。' : '点击可以查看成绩详情。'}
            </p>
          </div>
          {attempts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              暂无记录
            </div>
          ) : (
            attempts.map((attempt) => <AttemptRecord key={attempt.attemptId} attempt={attempt} />)
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AttemptRecord({ attempt }: { attempt: StudentRecentAttemptSummary }) {
  return (
    <Link
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
  );
}
