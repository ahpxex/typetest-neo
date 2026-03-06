import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { requireStudent } from '@/lib/auth/guards';
import { getActiveCampaign, getLeaderboard } from '@/lib/data/queries';
import { formatKpm, formatPercent } from '@/lib/format';

export default async function RankingPage() {
  const { student } = await requireStudent();
  const activeCampaign = await getActiveCampaign();

  if (!activeCampaign) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <Card title="暂无排行榜" description="当前没有激活场次。">
            <p className="text-sm text-zinc-500">请等待管理员激活场次后再查看。</p>
          </Card>
        </div>
      </main>
    );
  }

  const leaderboard = await getLeaderboard(activeCampaign.id);

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-500">当前场次：{activeCampaign.name}</p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">排行榜</h1>
          </div>
          <div className="flex gap-3">
            <Badge tone="info">当前登录：{student.name}</Badge>
            <Link href="/typing" className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100">返回测试</Link>
          </div>
        </header>

        <Card title="最佳成绩榜" description="每位学生按当前场次最佳成绩上榜。">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-zinc-500">
                <tr>
                  <th className="pb-3">排名</th>
                  <th className="pb-3">学生</th>
                  <th className="pb-3">班级</th>
                  <th className="pb-3">速度</th>
                  <th className="pb-3">正确率</th>
                  <th className="pb-3">Attempt</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => (
                  <tr key={entry.studentId} className={`border-t border-zinc-100 ${entry.studentId === student.id ? 'bg-zinc-50' : ''}`}>
                    <td className="py-3 font-semibold text-zinc-950">#{entry.rank}</td>
                    <td className="py-3">
                      <p className="font-medium text-zinc-950">{entry.name}</p>
                      <p className="text-xs text-zinc-400">{entry.studentNo}</p>
                    </td>
                    <td className="py-3">{entry.classCode ? `${entry.classCode} · ${entry.className}` : '未分班'}</td>
                    <td className="py-3">{formatKpm(entry.scoreKpm)}</td>
                    <td className="py-3">{formatPercent(entry.accuracy)}</td>
                    <td className="py-3">
                      <Link href={`/result/${entry.attemptId}`} className="rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-100">
                        查看成绩
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </main>
  );
}
