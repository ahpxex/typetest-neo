import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StudentPageShell } from '@/components/typing/student-page-shell';
import { requireStudent } from '@/lib/auth/guards';
import { getStudentCompetitions, type StudentCompetitionSummary } from '@/lib/data/queries';
import { getCompetitionPhaseLabel, type CompetitionPhase } from '@/lib/competition';
import { formatDateTime, formatDurationSeconds, formatKpm, formatPercent } from '@/lib/format';

const phaseVariant: Record<CompetitionPhase, 'secondary' | 'outline'> = {
  open: 'secondary',
  upcoming: 'outline',
  ended: 'outline',
  closed: 'outline',
  hidden: 'outline',
};

export default async function CompetitionsPage() {
  const { student } = await requireStudent();
  const competitions = await getStudentCompetitions(student.id);

  return (
    <StudentPageShell
      studentName={student.name}
      title="竞赛"
      description="参加限时竞赛，与全校同学同台比拼速度与准确率。"
    >
      <div className="flex min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-5xl content-start py-4">
          {competitions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
              目前还没有开放的竞赛，请稍后再来看看。
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {competitions.map((competition) => (
                <CompetitionCard key={competition.id} competition={competition} />
              ))}
            </div>
          )}
        </div>
      </div>
    </StudentPageShell>
  );
}

function CompetitionCard({ competition }: { competition: StudentCompetitionSummary }) {
  const canJoin = competition.phase === 'open';
  const ctaLabel = canJoin
    ? (competition.yourAttemptCount > 0 ? '再次参加' : '参加竞赛')
    : competition.phase === 'upcoming'
      ? '查看详情'
      : '查看成绩榜';

  return (
    <Card className="flex flex-col overflow-hidden shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">{competition.title}</CardTitle>
          <Badge variant={phaseVariant[competition.phase]}>{getCompetitionPhaseLabel(competition.phase)}</Badge>
        </div>
        <CardDescription>文章：{competition.articleTitle}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {competition.description ? (
          <p className="line-clamp-3 text-sm text-muted-foreground">{competition.description}</p>
        ) : null}

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <span>时长：{formatDurationSeconds(competition.durationSeconds)}</span>
          <span>每人 {competition.maxAttemptsPerStudent} 次</span>
          <span>开始：{competition.startAt ? formatDateTime(competition.startAt) : '已开放'}</span>
          <span>结束：{competition.endAt ? formatDateTime(competition.endAt) : '手动关闭'}</span>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          <p>参与人数：{competition.participantCount} 人</p>
          <p className="mt-1">
            我的最佳：
            {competition.yourBestScoreKpm === null
              ? ' 暂未参加'
              : ` ${formatKpm(competition.yourBestScoreKpm)} · ${formatPercent(competition.yourBestAccuracy ?? 0)}（已用 ${competition.yourAttemptCount} 次）`}
          </p>
        </div>

        <div className="mt-auto flex flex-wrap gap-2">
          <Button asChild className="flex-1" variant={canJoin ? 'default' : 'outline'}>
            <Link href={`/competitions/${competition.id}`}>{ctaLabel}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
