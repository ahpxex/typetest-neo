import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StudentPageShell } from '@/components/typing/student-page-shell';
import { TypingTestClient } from '@/components/typing/typing-test-client';
import { logoutAction } from '@/features/auth/actions';
import { requireStudent } from '@/lib/auth/guards';
import { ensureAttemptForStudent, ensureCompetitionAttemptForStudent } from '@/lib/data/queries';
import { getCompetitionPhaseLabel } from '@/lib/competition';
import { formatDateTime, formatDurationSeconds } from '@/lib/format';
import { getAttemptModeLabel, type AttemptMode } from '@/lib/attempt-mode';

const defaultControls = (
  <>
    <Button asChild variant="outline" size="sm">
      <Link href="/typing">返回首页</Link>
    </Button>
    <Button asChild variant="outline" size="sm">
      <Link href="/ranking">查看排行榜</Link>
    </Button>
    <form action={logoutAction}>
      <Button type="submit" variant="outline" size="sm">退出登录</Button>
    </form>
  </>
);

type NoticeCardProps = {
  studentName: string;
  title: string;
  description: string;
  cardTitle: string;
  cardDescription: string;
  body: React.ReactNode;
  controls: React.ReactNode;
};

function NoticeCard({ studentName, title, description, cardTitle, cardDescription, body, controls }: NoticeCardProps) {
  return (
    <StudentPageShell studentName={studentName} title={title} description={description} controls={controls}>
      <Card>
        <CardHeader>
          <CardTitle>{cardTitle}</CardTitle>
          <CardDescription>{cardDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">{body}</div>
        </CardContent>
      </Card>
    </StudentPageShell>
  );
}

type TypingRunViewProps = {
  studentName: string;
  studentNo: string;
  title: string;
  description: string;
  modeLabel: string;
  attemptId: number;
  articleTitle: string;
  referenceText: string;
  durationSeconds: number;
  startedAt: Date;
  controls: React.ReactNode;
};

function TypingRunView({
  studentName,
  studentNo,
  title,
  description,
  modeLabel,
  attemptId,
  articleTitle,
  referenceText,
  durationSeconds,
  startedAt,
  controls,
}: TypingRunViewProps) {
  return (
    <StudentPageShell
      studentName={studentName}
      title={title}
      description={description}
      extraInfo={
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:justify-end">
          <span>{studentNo}</span>
          <span>·</span>
          <span>{modeLabel}</span>
          <span>·</span>
          <span>{formatDurationSeconds(durationSeconds)}</span>
          <span>·</span>
          <span>{formatDateTime(startedAt)}</span>
        </div>
      }
      controls={controls}
    >
      <TypingTestClient
        attemptId={attemptId}
        articleTitle={articleTitle}
        referenceText={referenceText}
        durationSeconds={durationSeconds}
        startedAt={startedAt.toISOString()}
      />
    </StudentPageShell>
  );
}

export async function TypingSessionPage({ mode, practiceArticleId }: { mode: AttemptMode; practiceArticleId?: number }) {
  const { student } = await requireStudent();
  const typingContext = await ensureAttemptForStudent(student.id, mode, practiceArticleId);
  const modeLabel = getAttemptModeLabel(mode);
  const title = `${modeLabel}模式`;

  if (typingContext.state === 'no-article') {
    return (
      <NoticeCard
        studentName={student.name}
        title={title}
        description="系统暂时没有可用文章。"
        cardTitle="当前没有可用文章"
        cardDescription="系统暂时没有分配可用文章。"
        body={<p>请联系管理员检查文章库。</p>}
        controls={defaultControls}
      />
    );
  }

  if (typingContext.state === 'locked') {
    return (
      <NoticeCard
        studentName={student.name}
        title={title}
        description="当前账号已达到正式考试尝试次数上限。"
        cardTitle="你已经完成当前考试"
        cardDescription="当前账号已达到尝试次数上限。"
        body={
          <>
            <p>文章：{typingContext.article.title}</p>
            {typingContext.latestAttempt ? (
              <Button asChild>
                <Link href={`/result/${typingContext.latestAttempt.id}`}>查看最近一次成绩</Link>
              </Button>
            ) : null}
          </>
        }
        controls={defaultControls}
      />
    );
  }

  if (typingContext.state !== 'ready' || !typingContext.attempt) {
    return (
      <NoticeCard
        studentName={student.name}
        title={title}
        description="系统未能正确初始化当前记录。"
        cardTitle="测试初始化失败"
        cardDescription="系统未能正确创建当前记录，请刷新后再试。"
        body={<p>如果问题持续存在，请联系管理员检查配置。</p>}
        controls={defaultControls}
      />
    );
  }

  return (
    <TypingRunView
      studentName={student.name}
      studentNo={student.studentNo}
      title={title}
      description={mode === 'practice' ? '练习成绩不会进入正式排行榜，可以自由切换文章。' : '正式考试成绩会进入排行榜与后台统计。'}
      modeLabel={modeLabel}
      attemptId={typingContext.attempt.id}
      articleTitle={typingContext.article.title}
      referenceText={typingContext.article.contentRaw}
      durationSeconds={typingContext.attempt.durationSecondsAllocated}
      startedAt={typingContext.attempt.startedAt}
      controls={defaultControls}
    />
  );
}

export async function CompetitionSessionPage({ competitionId }: { competitionId: number }) {
  const { student } = await requireStudent();
  const typingContext = await ensureCompetitionAttemptForStudent(student.id, competitionId);
  const modeLabel = getAttemptModeLabel('competition');

  const controls = (
    <>
      <Button asChild variant="outline" size="sm">
        <Link href={`/competitions/${competitionId}`}>返回竞赛</Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href="/competitions">全部竞赛</Link>
      </Button>
      <form action={logoutAction}>
        <Button type="submit" variant="outline" size="sm">退出登录</Button>
      </form>
    </>
  );

  if (typingContext.state === 'not-found' || typingContext.state === 'missing-student') {
    return (
      <NoticeCard
        studentName={student.name}
        title="竞赛"
        description="未找到该竞赛。"
        cardTitle="竞赛不存在或未开放"
        cardDescription="该竞赛可能尚未发布或已被移除。"
        body={
          <Button asChild>
            <Link href="/competitions">查看全部竞赛</Link>
          </Button>
        }
        controls={controls}
      />
    );
  }

  if (typingContext.state === 'no-article') {
    return (
      <NoticeCard
        studentName={student.name}
        title="竞赛"
        description="竞赛文章暂不可用。"
        cardTitle="竞赛文章不可用"
        cardDescription="竞赛绑定的文章暂时无法使用。"
        body={<p>请联系管理员检查竞赛配置。</p>}
        controls={controls}
      />
    );
  }

  if (typingContext.state === 'not-open') {
    const phaseLabel = getCompetitionPhaseLabel(typingContext.phase);
    const description = typingContext.phase === 'upcoming'
      ? '竞赛尚未开始，请耐心等待。'
      : '竞赛已结束，无法再参加。';

    return (
      <NoticeCard
        studentName={student.name}
        title={typingContext.competition.title}
        description={description}
        cardTitle={`竞赛${phaseLabel}`}
        cardDescription={description}
        body={
          <Button asChild>
            <Link href={`/competitions/${competitionId}`}>查看竞赛详情</Link>
          </Button>
        }
        controls={controls}
      />
    );
  }

  if (typingContext.state === 'locked') {
    return (
      <NoticeCard
        studentName={student.name}
        title={typingContext.competition.title}
        description="你已用完该竞赛的参加次数。"
        cardTitle="参加次数已用完"
        cardDescription={`本竞赛每人最多可参加 ${typingContext.competition.maxAttemptsPerStudent} 次。`}
        body={
          <>
            {typingContext.latestAttempt ? (
              <Button asChild>
                <Link href={`/result/${typingContext.latestAttempt.id}`}>查看最近一次成绩</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href={`/competitions/${competitionId}`}>查看竞赛榜单</Link>
            </Button>
          </>
        }
        controls={controls}
      />
    );
  }

  return (
    <TypingRunView
      studentName={student.name}
      studentNo={student.studentNo}
      title={typingContext.competition.title}
      description="竞赛成绩将进入本竞赛的成绩榜，请认真作答。"
      modeLabel={modeLabel}
      attemptId={typingContext.attempt.id}
      articleTitle={typingContext.article.title}
      referenceText={typingContext.article.contentRaw}
      durationSeconds={typingContext.attempt.durationSecondsAllocated}
      startedAt={typingContext.attempt.startedAt}
      controls={controls}
    />
  );
}
