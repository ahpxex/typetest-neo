import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StudentPageShell } from '@/components/typing/student-page-shell';
import { TypingTestClient } from '@/components/typing/typing-test-client';
import { logoutAction } from '@/features/auth/actions';
import { requireStudent } from '@/lib/auth/guards';
import { ensureAttemptForStudent } from '@/lib/data/queries';
import { formatDateTime, formatDurationSeconds } from '@/lib/format';
import { getAttemptModeLabel, type AttemptMode } from '@/lib/attempt-mode';

export async function TypingSessionPage({ mode, practiceArticleId }: { mode: AttemptMode; practiceArticleId?: number }) {
  const { student } = await requireStudent();
  const typingContext = await ensureAttemptForStudent(student.id, mode, practiceArticleId);
  const modeLabel = getAttemptModeLabel(mode);

  const controls = (
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

  if (typingContext.state === 'no-article') {
    return (
      <StudentPageShell studentName={student.name} title={`${modeLabel}模式`} description="系统暂时没有可用文章。" controls={controls}>
        <Card>
          <CardHeader>
            <CardTitle>当前没有可用文章</CardTitle>
            <CardDescription>系统暂时没有分配可用文章。</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">请联系管理员检查文章库。</p>
          </CardContent>
        </Card>
      </StudentPageShell>
    );
  }

  if (typingContext.state === 'locked') {
    return (
      <StudentPageShell studentName={student.name} title={`${modeLabel}模式`} description="当前账号已达到正式考试尝试次数上限。" controls={controls}>
        <Card>
          <CardHeader>
            <CardTitle>你已经完成当前考试</CardTitle>
            <CardDescription>当前账号已达到尝试次数上限。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>文章：{typingContext.article.title}</p>
              {typingContext.latestAttempt ? (
                <Button asChild>
                  <Link href={`/result/${typingContext.latestAttempt.id}`}>查看最近一次成绩</Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </StudentPageShell>
    );
  }

  if (typingContext.state !== 'ready' || !typingContext.attempt) {
    return (
      <StudentPageShell studentName={student.name} title={`${modeLabel}模式`} description="系统未能正确初始化当前记录。" controls={controls}>
        <Card>
          <CardHeader>
            <CardTitle>测试初始化失败</CardTitle>
            <CardDescription>系统未能正确创建当前记录，请刷新后再试。</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">如果问题持续存在，请联系管理员检查配置。</p>
          </CardContent>
        </Card>
      </StudentPageShell>
    );
  }

  return (
    <StudentPageShell
      studentName={student.name}
      title={`${modeLabel}模式`}
      description={mode === 'practice' ? '练习成绩不会进入正式排行榜，可以自由切换文章。' : '正式考试成绩会进入排行榜与后台统计。'}
      extraInfo={
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:justify-end">
          <span>{student.studentNo}</span>
          <span>·</span>
          <span>{modeLabel}</span>
          <span>·</span>
          <span>{formatDurationSeconds(typingContext.attempt.durationSecondsAllocated)}</span>
          <span>·</span>
          <span>{formatDateTime(typingContext.attempt.startedAt)}</span>
        </div>
      }
      controls={controls}
    >
      <TypingTestClient
        attemptId={typingContext.attempt.id}
        articleTitle={typingContext.article.title}
        referenceText={typingContext.article.contentRaw}
        durationSeconds={typingContext.attempt.durationSecondsAllocated}
        startedAt={typingContext.attempt.startedAt.toISOString()}
      />
    </StudentPageShell>
  );
}
