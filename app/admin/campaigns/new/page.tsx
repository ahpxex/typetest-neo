import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { saveCampaignAction } from '@/features/admin/actions'
import { getArticlesList } from '@/lib/data/queries'

export default async function NewCampaignPage() {
  const articles = await getArticlesList()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">新建场次</h1>
        <p className="mt-2 text-sm text-muted-foreground">创建新的测试活动，并指定当前使用的固定文章。</p>
      </header>

      <Card>
        <CardHeader><CardTitle>场次信息</CardTitle></CardHeader>
        <CardContent>
          <form action={saveCampaignAction} className="space-y-5">
            <input type="hidden" name="redirectTo" value="/admin/campaigns" />
            <input type="hidden" name="articleStrategy" value="fixed" />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="name">场次名称</Label><Input id="name" name="name" required /></div>
              <div className="space-y-2"><Label htmlFor="academicYear">学年</Label><Input id="academicYear" name="academicYear" defaultValue="2025-2026" required /></div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2"><Label htmlFor="term">学期</Label><Input id="term" name="term" defaultValue="fall" required /></div>
              <div className="space-y-2"><Label htmlFor="mode">模式</Label><Select name="mode" defaultValue="exam"><SelectTrigger id="mode" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="exam">考试</SelectItem><SelectItem value="practice">练习</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="status">状态</Label><Select name="status" defaultValue="draft"><SelectTrigger id="status" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">草稿</SelectItem><SelectItem value="scheduled">待开放</SelectItem><SelectItem value="active">激活</SelectItem><SelectItem value="closed">关闭</SelectItem><SelectItem value="archived">归档</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2"><Label htmlFor="durationSeconds">时长（秒）</Label><Input id="durationSeconds" name="durationSeconds" type="number" defaultValue={180} required /></div>
              <div className="space-y-2"><Label htmlFor="maxAttemptsPerStudent">最大尝试次数</Label><Input id="maxAttemptsPerStudent" name="maxAttemptsPerStudent" type="number" defaultValue={1} required /></div>
              <div className="space-y-2"><Label htmlFor="rankingVisibility">排行榜可见性</Label><Select name="rankingVisibility" defaultValue="public"><SelectTrigger id="rankingVisibility" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">公开</SelectItem><SelectItem value="class_only">仅班级</SelectItem><SelectItem value="hidden">隐藏</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="startAt">开始时间</Label><Input id="startAt" name="startAt" type="datetime-local" /></div>
              <div className="space-y-2"><Label htmlFor="endAt">结束时间</Label><Input id="endAt" name="endAt" type="datetime-local" /></div>
            </div>
            <label htmlFor="allowRetry" className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm"><Checkbox id="allowRetry" name="allowRetry" />允许学生重复测试</label>
            <div className="space-y-2">
              <Label htmlFor="currentArticleId">当前固定文章</Label>
              <Select name="currentArticleId" defaultValue={articles[0] ? String(articles[0].id) : 'none'}>
                <SelectTrigger id="currentArticleId" className="w-full"><SelectValue placeholder="请选择文章" /></SelectTrigger>
                <SelectContent>
                  {articles.map((article) => <SelectItem key={article.id} value={String(article.id)}>{article.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">创建场次</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
