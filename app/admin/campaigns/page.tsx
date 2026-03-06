import Link from 'next/link'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getCampaignsList } from '@/lib/data/queries'
import { formatDateTime, formatDurationSeconds } from '@/lib/format'
import { AppSearchParams, getSearchParamValue } from '@/lib/search-params'

export default async function AdminCampaignsPage({ searchParams }: { searchParams?: AppSearchParams }) {
  const params = (await searchParams) ?? {}
  const success = getSearchParamValue(params.success)
  const error = getSearchParamValue(params.error)
  const campaigns = await getCampaignsList()

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">测试场次</h1>
          <p className="mt-2 text-sm text-muted-foreground">创建考试、分配文章并控制当前学生看到的测试内容。</p>
        </div>
        <Button asChild><Link href="/admin/campaigns/new">新建场次</Link></Button>
      </header>

      {success ? <Alert><AlertTitle>操作成功</AlertTitle><AlertDescription>{success}</AlertDescription></Alert> : null}
      {error ? <Alert variant="destructive"><AlertTitle>操作失败</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}

      <Card>
        <CardHeader><CardTitle>场次列表</CardTitle><CardDescription>当前共有 {campaigns.length} 个场次</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>时长</TableHead>
                <TableHead>策略</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground">{campaign.academicYear} / {campaign.term}</p>
                  </TableCell>
                  <TableCell>{campaign.mode}</TableCell>
                  <TableCell><Badge variant={campaign.status === 'active' ? 'secondary' : campaign.status === 'draft' ? 'outline' : 'default'}>{campaign.status}</Badge></TableCell>
                  <TableCell>{formatDurationSeconds(campaign.durationSeconds)}</TableCell>
                  <TableCell>{campaign.articleStrategy}</TableCell>
                  <TableCell>{formatDateTime(campaign.updatedAt)}</TableCell>
                  <TableCell><Button asChild variant="outline" size="sm"><Link href={`/admin/campaigns/${campaign.id}`}>查看 / 编辑</Link></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
