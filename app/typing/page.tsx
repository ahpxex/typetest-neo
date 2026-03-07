import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TypingTestClient } from '@/components/typing/typing-test-client';
import { logoutAction } from '@/features/auth/actions';
import { requireStudent } from '@/lib/auth/guards';
import { formatDateTime, formatDurationSeconds } from '@/lib/format';
import { ensureAttemptForStudent } from '@/lib/data/queries';

export default async function TypingPage() {
  const { student } = await requireStudent();
  const typingContext = await ensureAttemptForStudent(student.id);

  if (typingContext.state === 'no-article') {
    return (
      <PageWrap studentName={student.name}>
        <Card>
          <CardHeader>
            <CardTitle>当前没有可用文章</CardTitle>
            <CardDescription>系统暂时没有分配可用文章。</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">请联系管理员检查文章库。</p>
          </CardContent>
        </Card>
      </PageWrap>
    );
  }

  if (typingContext.state === 'locked') {
    return (
      <PageWrap studentName={student.name}>
        <Card>
          <CardHeader>
            <CardTitle>你已经完成当前测试</CardTitle>
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
      </PageWrap>
    );
  }

  if (typingContext.state !== 'ready' || !typingContext.attempt) {
    return (
      <PageWrap studentName={student.name}>
        <Card>
          <CardHeader>
            <CardTitle>测试初始化失败</CardTitle>
            <CardDescription>系统未能正确创建当前测试，请刷新后再试。</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">如果问题持续存在，请联系管理员检查配置。</p>
          </CardContent>
        </Card>
      </PageWrap>
    );
  }

  return (
    <PageWrap
      studentName={student.name}
      extraInfo={
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:justify-end">
          <span>{student.studentNo}</span>
          <span>·</span>
          <span>{formatDurationSeconds(typingContext.attempt.durationSecondsAllocated)}</span>
          <span>·</span>
          <span>{formatDateTime(typingContext.attempt.startedAt)}</span>
        </div>
      }
      controls={
        <>
          <Button asChild variant="outline" size="sm">
            <Link href="/ranking">查看排行榜</Link>
          </Button>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">退出登录</Button>
          </form>
        </>
      }
    >
      <TypingTestClient
        attemptId={typingContext.attempt.id}
        articleTitle={typingContext.article.title}
        referenceText={typingContext.article.contentRaw}
        durationSeconds={typingContext.attempt.durationSecondsAllocated}
        startedAt={typingContext.attempt.startedAt.toISOString()}
      />
    </PageWrap>
  );
}

function PageWrap({
  studentName,
  children,
  extraInfo,
  controls,
}: {
  studentName: string;
  children: React.ReactNode;
  extraInfo?: React.ReactNode;
  controls?: React.ReactNode;
}) {
  return (
    <main className="h-screen overflow-hidden bg-background px-4 py-4 md:px-6 md:py-5">
      <div className="mx-auto flex h-full max-w-7xl flex-col gap-4 overflow-hidden">
        <header className="shrink-0 border-b border-border pb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Student</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">打字测试</h1>
              <p className="text-sm text-muted-foreground">欢迎回来，{studentName}</p>
            </div>
            <div className="flex flex-col items-start gap-2 md:items-end">
              {extraInfo}
              <div className="flex flex-wrap items-center gap-2">{controls ?? <Button asChild variant="outline" size="sm"><Link href="/ranking">查看排行榜</Link></Button>}</div>
            </div>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </main>
  );
}
