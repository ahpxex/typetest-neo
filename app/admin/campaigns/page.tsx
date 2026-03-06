import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { NoticeBanner } from '@/components/ui/notice-banner';
import { getCampaignsList } from '@/lib/data/queries';
import { formatDateTime, formatDurationSeconds } from '@/lib/format';
import { AppSearchParams, getSearchParamValue } from '@/lib/search-params';

export default async function AdminCampaignsPage({ searchParams }: { searchParams?: AppSearchParams }) {
  const params = (await searchParams) ?? {};
  const success = getSearchParamValue(params.success);
  const error = getSearchParamValue(params.error);
  const campaigns = await getCampaignsList();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">测试场次</h1>
          <p className="mt-2 text-sm text-zinc-500">创建考试、分配文章并控制当前学生看到的测试内容。</p>
        </div>
        <Link href="/admin/campaigns/new" className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
          新建场次
        </Link>
      </header>

      <NoticeBanner message={success} tone="success" />
      <NoticeBanner message={error} tone="error" />

      <Card title="场次列表" description={`当前共有 ${campaigns.length} 个场次`}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="pb-3">名称</th>
                <th className="pb-3">类型</th>
                <th className="pb-3">状态</th>
                <th className="pb-3">时长</th>
                <th className="pb-3">策略</th>
                <th className="pb-3">更新时间</th>
                <th className="pb-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-t border-zinc-100">
                  <td className="py-3">
                    <p className="font-medium text-zinc-950">{campaign.name}</p>
                    <p className="text-xs text-zinc-400">{campaign.academicYear} / {campaign.term}</p>
                  </td>
                  <td className="py-3">{campaign.mode}</td>
                  <td className="py-3"><Badge tone={campaign.status === 'active' ? 'success' : campaign.status === 'draft' ? 'warning' : 'default'}>{campaign.status}</Badge></td>
                  <td className="py-3">{formatDurationSeconds(campaign.durationSeconds)}</td>
                  <td className="py-3">{campaign.articleStrategy}</td>
                  <td className="py-3">{formatDateTime(campaign.updatedAt)}</td>
                  <td className="py-3">
                    <Link href={`/admin/campaigns/${campaign.id}`} className="rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-100">
                      查看 / 编辑
                    </Link>
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
