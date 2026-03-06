import Link from 'next/link'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { setAttemptStatusAction } from '@/features/admin/actions'
import { getAttemptsList } from '@/lib/data/queries'
import { formatDateTime, formatKpm, formatPercent } from '@/lib/format'
import { AppSearchParams, getSearchParamValue } from '@/lib/search-params'

export default async function AdminAttemptsPage({ searchParams }: { searchParams?: AppSearchParams }) {
  const params = (await searchParams) ?? {}
  const success = getSearchParamValue(params.success)
  const error = getSearchParamValue(params.error)
  const query = getSearchParamValue(params.query) ?? ''

  const attempts = await getAttemptsList({ query: query || undefined })

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <header className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">成绩记录</h1>
        <p className="mt-1 text-sm text-muted-foreground">查看学生成绩，并对异常记录执行作废或恢复。</p>
      </header>

      {success ? <Alert className="shrink-0"><AlertTitle>操作成功</AlertTitle><AlertDescription>{success}</AlertDescription></Alert> : null}
      {error ? <Alert variant="destructive" className="shrink-0"><AlertTitle>操作失败</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardHeader className="shrink-0 pb-3">
          <CardTitle>成绩列表</CardTitle>
          <CardDescription>共 {attempts.length} 条记录</CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <form className="mb-3 flex shrink-0 gap-3">
            <Input name="query" defaultValue={query} placeholder="按学生、邮箱或文章搜索" />
            <Button type="submit" variant="outline">搜索</Button>
          </form>
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>学生</TableHead>
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
                          <input type="hidden" name="redirectTo" value={`/admin/attempts${query ? `?query=${encodeURIComponent(query)}` : ''}`} />
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
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
