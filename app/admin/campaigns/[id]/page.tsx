import { notFound } from 'next/navigation'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { saveCampaignAction, setCurrentArticleAction } from '@/features/admin/actions'
import { getArticlesList, getLatestCampaignCurrentArticle, getCampaignById, getLeaderboard } from '@/lib/data/queries'
import { formatDateTime, formatDurationSeconds, formatKpm, formatPercent } from '@/lib/format'
import { AppSearchParams, getSearchParamValue } from '@/lib/search-params'

export default async function CampaignDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: AppSearchParams }) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams])
  const campaignId = Number(id)
  const [campaign, articles, currentArticle, leaderboard] = await Promise.all([
    getCampaignById(campaignId),
    getArticlesList(),
    getLatestCampaignCurrentArticle(campaignId),
    getLeaderboard(campaignId),
  ])

  if (!campaign) notFound()

  const success = getSearchParamValue(resolvedSearchParams?.success)
  const error = getSearchParamValue(resolvedSearchParams?.error)

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{campaign.name}</h1>
          <Badge variant={campaign.status === 'active' ? 'secondary' : campaign.status === 'draft' ? 'outline' : 'default'}>{campaign.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{campaign.academicYear} / {campaign.term} · {campaign.mode} · {formatDurationSeconds(campaign.durationSeconds)}</p>
      </header>

      {success ? <Alert><AlertTitle>操作成功</AlertTitle><AlertDescription>{success}</AlertDescription></Alert> : null}
      {error ? <Alert variant="destructive"><AlertTitle>操作失败</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader><CardTitle>编辑场次</CardTitle></CardHeader>
          <CardContent>
            <form action={saveCampaignAction} className="space-y-5">
              <input type="hidden" name="id" value={campaign.id} />
              <input type="hidden" name="redirectTo" value={`/admin/campaigns/${campaign.id}`} />
              <input type="hidden" name="articleStrategy" value="fixed" />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="name">场次名称</Label><Input id="name" name="name" defaultValue={campaign.name} required /></div>
                <div className="space-y-2"><Label htmlFor="academicYear">学年</Label><Input id="academicYear" name="academicYear" defaultValue={campaign.academicYear} required /></div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2"><Label htmlFor="term">学期</Label><Input id="term" name="term" defaultValue={campaign.term} required /></div>
                <div className="space-y-2"><Label htmlFor="mode">模式</Label><Select name="mode" defaultValue={campaign.mode}><SelectTrigger id="mode" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="exam">考试</SelectItem><SelectItem value="practice">练习</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="status">状态</Label><Select name="status" defaultValue={campaign.status}><SelectTrigger id="status" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">草稿</SelectItem><SelectItem value="scheduled">待开放</SelectItem><SelectItem value="active">激活</SelectItem><SelectItem value="closed">关闭</SelectItem><SelectItem value="archived">归档</SelectItem></SelectContent></Select></div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2"><Label htmlFor="durationSeconds">时长（秒）</Label><Input id="durationSeconds" name="durationSeconds" type="number" defaultValue={campaign.durationSeconds} required /></div>
                <div className="space-y-2"><Label htmlFor="maxAttemptsPerStudent">最大尝试次数</Label><Input id="maxAttemptsPerStudent" name="maxAttemptsPerStudent" type="number" defaultValue={campaign.maxAttemptsPerStudent} required /></div>
                <div className="space-y-2"><Label htmlFor="rankingVisibility">排行榜可见性</Label><Select name="rankingVisibility" defaultValue={campaign.rankingVisibility}><SelectTrigger id="rankingVisibility" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">公开</SelectItem><SelectItem value="class_only">仅班级</SelectItem><SelectItem value="hidden">隐藏</SelectItem></SelectContent></Select></div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="startAt">开始时间</Label><Input id="startAt" name="startAt" type="datetime-local" defaultValue={campaign.startAt ? toDateTimeLocal(campaign.startAt) : ''} /></div>
                <div className="space-y-2"><Label htmlFor="endAt">结束时间</Label><Input id="endAt" name="endAt" type="datetime-local" defaultValue={campaign.endAt ? toDateTimeLocal(campaign.endAt) : ''} /></div>
              </div>
              <label htmlFor="allowRetry" className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm"><Checkbox id="allowRetry" name="allowRetry" defaultChecked={campaign.allowRetry} />允许学生重复测试</label>
              <div className="space-y-2"><Label htmlFor="currentArticleId">当前固定文章</Label><Select name="currentArticleId" defaultValue={currentArticle?.articleId ? String(currentArticle.articleId) : (articles[0] ? String(articles[0].id) : 'none')}><SelectTrigger id="currentArticleId" className="w-full"><SelectValue placeholder="请选择文章" /></SelectTrigger><SelectContent>{articles.map((article) => <SelectItem key={article.id} value={String(article.id)}>{article.title}</SelectItem>)}</SelectContent></Select></div>
              <Button type="submit">保存场次</Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>当前固定文章</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>当前文章：{articles.find((article) => article.id === currentArticle?.articleId)?.title ?? '未设置'}</p>
                <p>最近更新时间：{formatDateTime(currentArticle?.createdAt)}</p>
                <form action={setCurrentArticleAction} className="space-y-3">
                  <input type="hidden" name="redirectTo" value={`/admin/campaigns/${campaign.id}`} />
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <Select name="articleId" defaultValue={String(currentArticle?.articleId ?? articles[0]?.id ?? '')}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{articles.map((article) => <SelectItem key={article.id} value={String(article.id)}>{article.title}</SelectItem>)}</SelectContent></Select>
                  <Button type="submit" className="w-full">切换当前文章</Button>
                </form>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>排行榜预览</CardTitle><CardDescription>当前有 {leaderboard.length} 名学生进入榜单</CardDescription></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {leaderboard.slice(0, 8).map((entry) => (
                  <div key={entry.studentId} className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">#{entry.rank} {entry.name}</p>
                      <p className="text-xs text-muted-foreground">{entry.studentNo} · {entry.classCode ?? '未分班'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatKpm(entry.scoreKpm)}</p>
                      <p className="text-xs text-muted-foreground">{formatPercent(entry.accuracy)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function toDateTimeLocal(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}
