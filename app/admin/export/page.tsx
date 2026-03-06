import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCampaignsList } from '@/lib/data/queries'

export default async function AdminExportPage() {
  const campaigns = await getCampaignsList()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">导出中心</h1>
        <p className="mt-2 text-sm text-muted-foreground">按场次导出全部成绩，默认使用 CSV 以保证兼容和简单。</p>
      </header>

      <Card>
        <CardHeader><CardTitle>导出全部成绩</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>直接导出当前库中的全部 attempt 记录。</p>
            <Button asChild><Link href="/api/export/attempts">导出全部 CSV</Link></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>按场次导出</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{campaign.name}</p>
                  <p className="text-muted-foreground">{campaign.academicYear} / {campaign.term}</p>
                </div>
                <Button asChild variant="outline"><Link href={`/api/export/attempts?campaignId=${campaign.id}`}>导出这个场次</Link></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
