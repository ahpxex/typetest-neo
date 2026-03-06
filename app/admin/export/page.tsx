import Link from 'next/link';

import { Card } from '@/components/ui/card';
import { getCampaignsList } from '@/lib/data/queries';

export default async function AdminExportPage() {
  const campaigns = await getCampaignsList();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">导出中心</h1>
        <p className="mt-2 text-sm text-zinc-500">按场次导出全部成绩，默认使用 CSV 以保证兼容和简单。</p>
      </header>

      <Card title="导出全部成绩">
        <div className="space-y-3 text-sm text-zinc-600">
          <p>直接导出当前库中的全部 attempt 记录。</p>
          <Link href="/api/export/attempts" className="inline-flex rounded-xl bg-zinc-900 px-4 py-2 font-medium text-white">
            导出全部 CSV
          </Link>
        </div>
      </Card>

      <Card title="按场次导出">
        <div className="grid gap-3">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-zinc-950">{campaign.name}</p>
                <p className="text-zinc-400">{campaign.academicYear} / {campaign.term}</p>
              </div>
              <Link href={`/api/export/attempts?campaignId=${campaign.id}`} className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-zinc-700 hover:bg-zinc-100">
                导出这个场次
              </Link>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
