import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { requireStudent } from '@/lib/auth/guards'
import { getActiveCampaign, getLeaderboard } from '@/lib/data/queries'
import { formatKpm, formatPercent } from '@/lib/format'

export default async function RankingPage() {
  const { student } = await requireStudent()
  const activeCampaign = await getActiveCampaign()

  if (!activeCampaign) {
    return (
      <main className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <Card>
            <CardHeader><CardTitle>暂无排行榜</CardTitle><CardDescription>当前没有激活场次。</CardDescription></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">请等待管理员激活场次后再查看。</p></CardContent>
          </Card>
        </div>
      </main>
    )
  }

  const leaderboard = await getLeaderboard(activeCampaign.id)

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">当前场次：{activeCampaign.name}</p>
            <h1 className="text-3xl font-semibold tracking-tight">排行榜</h1>
          </div>
          <div className="flex gap-3">
            <Badge variant="outline">当前登录：{student.name}</Badge>
            <Button asChild variant="outline"><Link href="/typing">返回测试</Link></Button>
          </div>
        </header>

        <Card>
          <CardHeader><CardTitle>最佳成绩榜</CardTitle><CardDescription>每位学生按当前场次最佳成绩上榜。</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>排名</TableHead>
                  <TableHead>学生</TableHead>
                  <TableHead>班级</TableHead>
                  <TableHead>速度</TableHead>
                  <TableHead>正确率</TableHead>
                  <TableHead>Attempt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((entry) => (
                  <TableRow key={entry.studentId} className={entry.studentId === student.id ? 'bg-muted/30' : ''}>
                    <TableCell className="font-semibold">#{entry.rank}</TableCell>
                    <TableCell><p className="font-medium">{entry.name}</p><p className="text-xs text-muted-foreground">{entry.studentNo}</p></TableCell>
                    <TableCell>{entry.classCode ? `${entry.classCode} · ${entry.className}` : '未分班'}</TableCell>
                    <TableCell>{formatKpm(entry.scoreKpm)}</TableCell>
                    <TableCell>{formatPercent(entry.accuracy)}</TableCell>
                    <TableCell><Button asChild variant="outline" size="sm"><Link href={`/result/${entry.attemptId}`}>查看成绩</Link></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
