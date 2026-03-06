import Link from 'next/link'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { setAttemptStatusAction } from '@/features/admin/actions'
import { getAttemptsList, getCampaignsList } from '@/lib/data/queries'
import { formatDateTime, formatKpm, formatPercent } from '@/lib/format'
import { AppSearchParams, getSearchParamValue } from '@/lib/search-params'

export default async function AdminAttemptsPage({ searchParams }: { searchParams?: AppSearchParams }) {
  const params = (await searchParams) ?? {}
  const success = getSearchParamValue(params.success)
  const error = getSearchParamValue(params.error)
  const query = getSearchParamValue(params.query) ?? ''
  const rawStatus = getSearchParamValue(params.status) ?? ''
  const status = rawStatus === 'all' ? '' : rawStatus
  const campaignId = Number(getSearchParamValue(params.campaignId) ?? 0) || 0

  const [campaigns, attempts] = await Promise.all([
    getCampaignsList(),
    getAttemptsList({ campaignId: campaignId || undefined, status: status || undefined, query: query || undefined }),
  ])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">成绩记录</h1>
        <p className="mt-2 text-sm text-muted-foreground">查看学生成绩、筛选 attempt，并对异常记录执行作废或恢复。</p>
      </header>

      {success ? <Alert><AlertTitle>操作成功</AlertTitle><AlertDescription>{success}</AlertDescription></Alert> : null}
      {error ? <Alert variant="destructive"><AlertTitle>操作失败</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}

      <Card>
        <CardHeader><CardTitle>筛选条件</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_220px_auto]">
            <Input name="query" defaultValue={query} placeholder="按学生、邮箱、文章或场次搜索" />
            <Select name="status" defaultValue={status || 'all'}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="started">started</SelectItem>
                <SelectItem value="submitted">submitted</SelectItem>
                <SelectItem value="invalidated">invalidated</SelectItem>
                <SelectItem value="expired">expired</SelectItem>
              </SelectContent>
            </Select>
            <Select name="campaignId" defaultValue={campaignId ? String(campaignId) : 'all'}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部场次</SelectItem>
                {campaigns.map((campaign) => <SelectItem key={campaign.id} value={String(campaign.id)}>{campaign.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="submit" variant="outline">筛选</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>成绩列表</CardTitle><CardDescription>共 {attempts.length} 条记录</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>学生</TableHead>
                <TableHead>场次</TableHead>
                <TableHead>文章</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>速度</TableHead>
                <TableHead>正确率</TableHead>
                <TableHead>提交时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.map((attempt) => (
                <TableRow key={attempt.id}>
                  <TableCell>
                    <p className="font-medium">{attempt.studentName}</p>
                    <p className="text-xs text-muted-foreground">{attempt.studentNo} · {attempt.campusEmail}</p>
                  </TableCell>
                  <TableCell>{attempt.campaignName}</TableCell>
                  <TableCell>{attempt.articleTitle}</TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <Badge variant={attempt.status === 'submitted' ? 'secondary' : attempt.status === 'invalidated' ? 'destructive' : 'outline'}>{attempt.status}</Badge>
                      {attempt.suspicionFlags.length > 0 ? <p className="text-xs text-amber-600">{attempt.suspicionFlags.join(', ')}</p> : null}
                    </div>
                  </TableCell>
                  <TableCell>{formatKpm(attempt.scoreKpm)}</TableCell>
                  <TableCell>{formatPercent(attempt.accuracy)}</TableCell>
                  <TableCell>{formatDateTime(attempt.submittedAt)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm"><Link href={`/result/${attempt.id}`}>详情</Link></Button>
                      <form action={setAttemptStatusAction}>
                        <input type="hidden" name="redirectTo" value={`/admin/attempts${query || status || campaignId ? `?query=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}&campaignId=${campaignId || ''}` : ''}`} />
                        <input type="hidden" name="attemptId" value={attempt.id} />
                        <input type="hidden" name="status" value={attempt.status === 'invalidated' ? 'submitted' : 'invalidated'} />
                        <Button type="submit" variant="outline" size="sm">{attempt.status === 'invalidated' ? '恢复' : '作废'}</Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
