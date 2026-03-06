import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { NoticeBanner } from '@/components/ui/notice-banner';
import { setAttemptStatusAction } from '@/features/admin/actions';
import { getAttemptsList, getCampaignsList } from '@/lib/data/queries';
import { formatDateTime, formatKpm, formatPercent } from '@/lib/format';
import { AppSearchParams, getSearchParamValue } from '@/lib/search-params';

export default async function AdminAttemptsPage({ searchParams }: { searchParams?: AppSearchParams }) {
  const params = (await searchParams) ?? {};
  const success = getSearchParamValue(params.success);
  const error = getSearchParamValue(params.error);
  const query = getSearchParamValue(params.query) ?? '';
  const status = getSearchParamValue(params.status) ?? '';
  const campaignId = Number(getSearchParamValue(params.campaignId) ?? 0);

  const [campaigns, attempts] = await Promise.all([
    getCampaignsList(),
    getAttemptsList({
      campaignId: campaignId || undefined,
      status: status || undefined,
      query: query || undefined,
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">成绩记录</h1>
        <p className="mt-2 text-sm text-zinc-500">查看学生成绩、筛选 attempt，并对异常记录执行作废或恢复。</p>
      </header>

      <NoticeBanner message={success} tone="success" />
      <NoticeBanner message={error} tone="error" />

      <Card title="筛选条件">
        <form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_220px_auto]">
          <input name="query" defaultValue={query} placeholder="按学生、邮箱、文章或场次搜索" className="w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none transition focus:border-zinc-900" />
          <select name="status" defaultValue={status} className="rounded-xl border border-zinc-200 px-3 py-2 outline-none transition focus:border-zinc-900">
            <option value="">全部状态</option>
            <option value="started">started</option>
            <option value="submitted">submitted</option>
            <option value="invalidated">invalidated</option>
            <option value="expired">expired</option>
          </select>
          <select name="campaignId" defaultValue={campaignId || ''} className="rounded-xl border border-zinc-200 px-3 py-2 outline-none transition focus:border-zinc-900">
            <option value="">全部场次</option>
            {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
          </select>
          <button type="submit" className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100">筛选</button>
        </form>
      </Card>

      <Card title="成绩列表" description={`共 ${attempts.length} 条记录`}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="pb-3">学生</th>
                <th className="pb-3">场次</th>
                <th className="pb-3">文章</th>
                <th className="pb-3">状态</th>
                <th className="pb-3">速度</th>
                <th className="pb-3">正确率</th>
                <th className="pb-3">提交时间</th>
                <th className="pb-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((attempt) => (
                <tr key={attempt.id} className="border-t border-zinc-100 align-top">
                  <td className="py-3">
                    <p className="font-medium text-zinc-950">{attempt.studentName}</p>
                    <p className="text-xs text-zinc-400">{attempt.studentNo} · {attempt.campusEmail}</p>
                  </td>
                  <td className="py-3">{attempt.campaignName}</td>
                  <td className="py-3">{attempt.articleTitle}</td>
                  <td className="py-3">
                    <div className="space-y-2">
                      <Badge tone={attempt.status === 'submitted' ? 'success' : attempt.status === 'invalidated' ? 'danger' : 'warning'}>{attempt.status}</Badge>
                      {attempt.suspicionFlags.length > 0 ? <p className="text-xs text-amber-600">{attempt.suspicionFlags.join(', ')}</p> : null}
                    </div>
                  </td>
                  <td className="py-3">{formatKpm(attempt.scoreKpm)}</td>
                  <td className="py-3">{formatPercent(attempt.accuracy)}</td>
                  <td className="py-3">{formatDateTime(attempt.submittedAt)}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/result/${attempt.id}`} className="rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-100">
                        详情
                      </Link>
                      <form action={setAttemptStatusAction}>
                        <input type="hidden" name="redirectTo" value={`/admin/attempts${query || status || campaignId ? `?query=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}&campaignId=${campaignId || ''}` : ''}`} />
                        <input type="hidden" name="attemptId" value={attempt.id} />
                        <input type="hidden" name="status" value={attempt.status === 'invalidated' ? 'submitted' : 'invalidated'} />
                        <button type="submit" className="rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-100">
                          {attempt.status === 'invalidated' ? '恢复' : '作废'}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
