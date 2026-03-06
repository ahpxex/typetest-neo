import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getAnySignedInUser } from '@/lib/auth/guards';
import { getAttemptDetail, getLeaderboard } from '@/lib/data/queries';
import { formatDateTime, formatDurationSeconds, formatKpm, formatPercent } from '@/lib/format';

export default async function ResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const [{ attemptId }, viewer] = await Promise.all([params, getAnySignedInUser()]);
  const attempt = await getAttemptDetail(Number(attemptId));

  if (!attempt) {
    redirect('/');
  }

  if (!viewer) {
    redirect('/');
  }

  if (viewer.type === 'student' && viewer.student.id !== attempt.studentId) {
    redirect('/typing');
  }

  const leaderboard = await getLeaderboard(attempt.campaignId);
  const overallRank = leaderboard.find((entry) => entry.attemptId === attempt.attemptId)?.rank;
  const classRank = leaderboard.filter((entry) => entry.classCode && entry.classCode === attempt.classCode).find((entry) => entry.attemptId === attempt.attemptId)?.rank;

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">成绩结果</h1>
            <Badge tone={attempt.status === 'submitted' ? 'success' : attempt.status === 'invalidated' ? 'danger' : 'warning'}>{attempt.status}</Badge>
          </div>
          <p className="text-sm text-zinc-500">{attempt.campaignName} · {attempt.articleTitle}</p>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card title="成绩摘要">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Metric title="学生" value={attempt.studentName} description={attempt.studentNo} />
              <Metric title="速度" value={formatKpm(attempt.scoreKpm)} description="服务端最终结算" />
              <Metric title="正确率" value={formatPercent(attempt.accuracy)} description="按最终文本复算" />
              <Metric title="正确字符" value={String(attempt.charCountCorrect)} description="匹配成功的字符数" />
              <Metric title="错误字符" value={String(attempt.charCountError)} description="不匹配或超出的字符数" />
              <Metric title="输入总量" value={String(attempt.charCountTyped)} description="最终提交文本长度" />
              <Metric title="退格次数" value={String(attempt.backspaceCount)} description="前端实时统计" />
              <Metric title="粘贴次数" value={String(attempt.pasteCount)} description="用于风控提示" />
              <Metric title="用时" value={formatDurationSeconds(attempt.durationSecondsUsed ?? attempt.durationSecondsAllocated)} description="最终记分用时" />
            </div>
          </Card>

          <div className="space-y-6">
            <Card title="排名信息">
              <div className="space-y-3 text-sm text-zinc-600">
                <p>总榜排名：{overallRank ? `#${overallRank}` : '未上榜'}</p>
                <p>班级排名：{classRank ? `#${classRank}` : '未分班或无班级榜'}</p>
                <p>提交时间：{formatDateTime(attempt.submittedAt)}</p>
                <p>开始时间：{formatDateTime(attempt.startedAt)}</p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Link href="/ranking" className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100">查看排行榜</Link>
                  <Link href="/typing" className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white">返回测试页</Link>
                </div>
              </div>
            </Card>

            {attempt.suspicionFlags.length > 0 ? (
              <Card title="风控提示">
                <ul className="space-y-2 text-sm text-amber-700">
                  {attempt.suspicionFlags.map((flag) => <li key={flag}>- {flag}</li>)}
                </ul>
              </Card>
            ) : null}
          </div>
        </section>

        <Card title="提交文本">
          <div className="rounded-2xl bg-zinc-50 p-4 text-sm leading-7 text-zinc-700 whitespace-pre-wrap">{attempt.typedTextRaw || '（无输入内容）'}</div>
        </Card>
      </div>
    </main>
  );
}

function Metric({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">{value}</p>
      <p className="mt-2 text-sm text-zinc-500">{description}</p>
    </div>
  );
}
