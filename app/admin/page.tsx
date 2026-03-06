import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getDashboardOverview } from '@/lib/data/queries';
import { formatDateTime, formatKpm } from '@/lib/format';

export default async function AdminDashboardPage() {
  const overview = await getDashboardOverview();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-zinc-500">欢迎回来，当前系统已经接入学生端、场次、文章与成绩管理主流程。</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">后台总览</h1>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="学生数" value={String(overview.totalStudents)} description="已录入可用学生账号" />
        <MetricCard title="文章数" value={String(overview.totalArticles)} description="已保存题库文章" />
        <MetricCard title="成绩记录" value={String(overview.totalAttempts)} description="累计 attempt 记录" />
        <MetricCard
          title="当前激活场次"
          value={overview.activeCampaign?.name ?? '无'}
          description={overview.activeCampaign ? overview.activeCampaign.term : '请前往场次页发布测试'}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card title="快速入口" description="常用操作都放在这里，方便一键进入。">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { href: '/admin/classes', label: '班级管理', desc: '创建班级并维护编码' },
              { href: '/admin/students', label: '学生管理', desc: '录入学生并检查邮箱' },
              { href: '/admin/articles', label: '文章题库', desc: '新建、编辑和发布文章' },
              { href: '/admin/campaigns', label: '测试场次', desc: '设置当前测试和文章策略' },
              { href: '/admin/attempts', label: '成绩记录', desc: '查看、筛选和作废成绩' },
              { href: '/admin/export', label: '导出数据', desc: '导出 CSV 成绩报表' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 transition hover:border-zinc-900 hover:bg-white"
              >
                <p className="font-semibold text-zinc-950">{item.label}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-500">{item.desc}</p>
              </Link>
            ))}
          </div>
        </Card>

        <Card title="当前场次" description="可快速确认现在学生进入的是哪场测试。">
          {overview.activeCampaign ? (
            <div className="space-y-3 text-sm text-zinc-600">
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-950">{overview.activeCampaign.name}</span>
                <Badge tone="success">{overview.activeCampaign.status}</Badge>
              </div>
              <p>{overview.activeCampaign.academicYear} / {overview.activeCampaign.term}</p>
              <p>时长：{overview.activeCampaign.durationSeconds} 秒</p>
              <p>策略：{overview.activeCampaign.articleStrategy}</p>
              <Link href={`/admin/campaigns/${overview.activeCampaign.id}`} className="inline-flex rounded-xl bg-zinc-900 px-4 py-2 font-medium text-white">
                进入场次详情
              </Link>
            </div>
          ) : (
            <div className="space-y-3 text-sm text-zinc-500">
              <p>当前暂无激活场次，请先创建并激活测试场次。</p>
              <Link href="/admin/campaigns/new" className="inline-flex rounded-xl bg-zinc-900 px-4 py-2 font-medium text-white">
                创建场次
              </Link>
            </div>
          )}
        </Card>
      </section>

      <Card title="最近成绩" description="最近提交的成绩会出现在这里。">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="pb-3">学生</th>
                <th className="pb-3">场次</th>
                <th className="pb-3">文章</th>
                <th className="pb-3">状态</th>
                <th className="pb-3">速度</th>
                <th className="pb-3">提交时间</th>
              </tr>
            </thead>
            <tbody>
              {overview.recentAttempts.map((attempt) => (
                <tr key={attempt.attemptId} className="border-t border-zinc-100">
                  <td className="py-3">
                    <p className="font-medium text-zinc-950">{attempt.studentName}</p>
                    <p className="text-xs text-zinc-400">{attempt.studentNo}</p>
                  </td>
                  <td className="py-3">{attempt.campaignName ?? '—'}</td>
                  <td className="py-3">{attempt.articleTitle}</td>
                  <td className="py-3"><Badge tone={attempt.status === 'submitted' ? 'success' : 'default'}>{attempt.status}</Badge></td>
                  <td className="py-3">{formatKpm(attempt.scoreKpm)}</td>
                  <td className="py-3">{formatDateTime(attempt.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function MetricCard({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
    </div>
  );
}
