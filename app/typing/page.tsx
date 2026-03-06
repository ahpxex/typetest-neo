import Link from 'next/link';

import { Card } from '@/components/ui/card';
import { TypingTestClient } from '@/components/typing/typing-test-client';
import { logoutAction } from '@/features/auth/actions';
import { requireStudent } from '@/lib/auth/guards';
import { formatDateTime, formatDurationSeconds } from '@/lib/format';
import { ensureAttemptForStudent } from '@/lib/data/queries';

export default async function TypingPage() {
  const { student } = await requireStudent();
  const typingContext = await ensureAttemptForStudent(student.id);

  if (typingContext.state === 'no-campaign') {
    return (
      <PageWrap studentName={student.name}>
        <Card title="当前暂无测试场次" description="请等待管理员发布新的考试后再进入。">
          <p className="text-sm text-zinc-500">系统还没有激活场次，请稍后再试。</p>
        </Card>
      </PageWrap>
    );
  }

  if (typingContext.state === 'no-article') {
    return (
      <PageWrap studentName={student.name}>
        <Card title="当前场次没有可用文章" description="管理员尚未给这个场次分配文章。">
          <p className="text-sm text-zinc-500">请联系管理员检查当前场次配置。</p>
        </Card>
      </PageWrap>
    );
  }

  if (typingContext.state === 'locked') {
    return (
      <PageWrap studentName={student.name}>
        <Card title="你已经完成当前场次" description="当前账号在这个场次下已达到尝试次数上限。">
          <div className="space-y-3 text-sm text-zinc-600">
            <p>场次：{typingContext.campaign.name}</p>
            <p>文章：{typingContext.article.title}</p>
            {typingContext.latestAttempt ? (
              <Link
                href={`/result/${typingContext.latestAttempt.id}`}
                className="inline-flex rounded-xl bg-zinc-900 px-4 py-2 font-medium text-white"
              >
                查看最近一次成绩
              </Link>
            ) : null}
          </div>
        </Card>
      </PageWrap>
    );
  }

  if (typingContext.state !== 'ready' || !typingContext.attempt) {
    return (
      <PageWrap studentName={student.name}>
        <Card title="测试初始化失败" description="系统未能正确创建当前测试，请刷新后再试。">
          <p className="text-sm text-zinc-500">如果问题持续存在，请联系管理员检查场次配置。</p>
        </Card>
      </PageWrap>
    );
  }

  return (
    <PageWrap studentName={student.name}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
        <div>
          <p className="text-sm text-zinc-500">当前学生：{student.name}</p>
          <p className="text-xs text-zinc-400">
            {student.studentNo} · {student.campusEmail}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">
          <span>场次时长：{formatDurationSeconds(typingContext.campaign.durationSeconds)}</span>
          <span>开始时间：{formatDateTime(typingContext.attempt.startedAt)}</span>
          <form action={logoutAction}>
            <button type="submit" className="rounded-xl border border-zinc-200 px-3 py-2 text-zinc-700 hover:bg-zinc-100">
              退出登录
            </button>
          </form>
        </div>
      </div>

      <TypingTestClient
        attemptId={typingContext.attempt.id}
        articleTitle={typingContext.article.title}
        campaignName={typingContext.campaign.name}
        referenceText={typingContext.article.contentRaw}
        durationSeconds={typingContext.campaign.durationSeconds}
        startedAt={typingContext.attempt.startedAt.toISOString()}
      />
    </PageWrap>
  );
}

function PageWrap({
  studentName,
  children,
}: {
  studentName: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">Student</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">打字测试</h1>
              <p className="text-sm text-zinc-500">欢迎回来，{studentName}</p>
            </div>
            <Link href="/ranking" className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100">
              查看排行榜
            </Link>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
