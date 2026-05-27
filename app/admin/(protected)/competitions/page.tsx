import Link from 'next/link'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CompetitionForm } from '@/components/admin/competition-form'
import {
  deleteCompetitionAction,
  updateCompetitionStatusAction,
} from '@/features/admin/competition-actions'
import { canManageCompetitions } from '@/lib/auth/admin-authorization'
import { requireAdmin } from '@/lib/auth/guards'
import {
  getAdminCompetitions,
  getArticleOptionsForCompetition,
  type AdminCompetitionSummary,
} from '@/lib/data/queries'
import {
  getCompetitionPhaseLabel,
  getCompetitionStatusLabel,
  type CompetitionStatus,
} from '@/lib/competition'
import { formatDateTime, formatKpm } from '@/lib/format'
import { AppSearchParams, getSearchParamValue } from '@/lib/search-params'

const COMPETITIONS_PATH = '/admin/competitions'

const statusVariant: Record<CompetitionStatus, 'secondary' | 'outline' | 'destructive'> = {
  draft: 'outline',
  published: 'secondary',
  closed: 'outline',
  archived: 'destructive',
}

function StatusActionButton({
  competitionId,
  action,
  label,
  variant = 'outline',
}: {
  competitionId: number
  action: 'publish' | 'close' | 'archive' | 'draft'
  label: string
  variant?: 'default' | 'outline' | 'secondary'
}) {
  return (
    <form action={updateCompetitionStatusAction}>
      <input type="hidden" name="redirectTo" value={COMPETITIONS_PATH} />
      <input type="hidden" name="competitionId" value={competitionId} />
      <input type="hidden" name="action" value={action} />
      <Button type="submit" variant={variant} size="sm">{label}</Button>
    </form>
  )
}

function CompetitionActions({
  competition,
  articleOptions,
}: {
  competition: AdminCompetitionSummary
  articleOptions: Awaited<ReturnType<typeof getArticleOptionsForCompetition>>
}) {
  const canDelete = competition.status === 'draft' && competition.attemptCount === 0

  return (
    <div className="flex flex-wrap gap-2">
      {competition.status === 'draft' ? (
        <StatusActionButton competitionId={competition.id} action="publish" label="开启" variant="default" />
      ) : null}
      {competition.status === 'published' ? (
        <StatusActionButton competitionId={competition.id} action="close" label="关闭" />
      ) : null}
      {competition.status === 'closed' ? (
        <StatusActionButton competitionId={competition.id} action="publish" label="重新开启" variant="default" />
      ) : null}
      {competition.status === 'archived' ? (
        <StatusActionButton competitionId={competition.id} action="draft" label="恢复为草稿" />
      ) : null}

      {competition.status !== 'archived' ? (
        <CompetitionForm
          mode="edit"
          redirectTo={COMPETITIONS_PATH}
          articleOptions={articleOptions}
          competition={competition}
          trigger={<Button variant="outline" size="sm">编辑</Button>}
        />
      ) : null}

      {competition.status !== 'archived' && competition.status !== 'draft' ? (
        <StatusActionButton competitionId={competition.id} action="archive" label="归档" />
      ) : null}

      {canDelete ? (
        <form action={deleteCompetitionAction}>
          <input type="hidden" name="redirectTo" value={COMPETITIONS_PATH} />
          <input type="hidden" name="competitionId" value={competition.id} />
          <Button type="submit" variant="outline" size="sm">删除</Button>
        </form>
      ) : null}
    </div>
  )
}

export default async function AdminCompetitionsPage({ searchParams }: { searchParams?: AppSearchParams }) {
  const { admin } = await requireAdmin()
  const params = (await searchParams) ?? {}
  const success = getSearchParamValue(params.success)
  const error = getSearchParamValue(params.error)
  const canManage = canManageCompetitions(admin.role)

  const [competitions, articleOptions] = await Promise.all([
    getAdminCompetitions(),
    getArticleOptionsForCompetition(),
  ])

  const activeCount = competitions.filter((competition) => competition.phase === 'open').length

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">竞赛管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            共 {competitions.length} 场 · 进行中 {activeCount} 场 · 创建后点击「开启」即可让学生参加
          </p>
        </div>
        {canManage ? (
          <CompetitionForm mode="create" redirectTo={COMPETITIONS_PATH} articleOptions={articleOptions} />
        ) : null}
      </header>

      {success ? (
        <Alert className="shrink-0">
          <AlertTitle>操作成功</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive" className="shrink-0">
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {canManage && articleOptions.length === 0 ? (
        <Alert className="shrink-0">
          <AlertTitle>还没有可用文章</AlertTitle>
          <AlertDescription>
            竞赛需要绑定一篇已发布的文章。请先前往
            <Link href="/admin/articles" className="mx-1 font-semibold underline underline-offset-4">文章管理</Link>
            导入并发布文章。
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>竞赛</TableHead>
                  <TableHead>文章</TableHead>
                  <TableHead>时间窗口</TableHead>
                  <TableHead>规则</TableHead>
                  <TableHead>参与情况</TableHead>
                  <TableHead>状态</TableHead>
                  {canManage ? <TableHead>操作</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {competitions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 7 : 6} className="py-10 text-center text-sm text-muted-foreground">
                      还没有竞赛，点击右上角「新建竞赛」创建。
                    </TableCell>
                  </TableRow>
                ) : (
                  competitions.map((competition) => (
                    <TableRow key={competition.id}>
                      <TableCell>
                        <Link href={`/admin/competitions/${competition.id}`} className="font-medium underline-offset-4 hover:underline">
                          {competition.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">{competition.slug}</p>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="truncate">{competition.articleTitle}</p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <p>开始：{competition.startAt ? formatDateTime(competition.startAt) : '开启即开始'}</p>
                        <p>结束：{competition.endAt ? formatDateTime(competition.endAt) : '手动关闭'}</p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <p>{competition.durationSeconds} 秒</p>
                        <p>每人 {competition.maxAttemptsPerStudent} 次</p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <p>参与 {competition.participantCount} 人 · {competition.attemptCount} 次</p>
                        <p>最佳 {competition.bestScoreKpm === null ? '—' : formatKpm(competition.bestScoreKpm)}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant={statusVariant[competition.status]}>
                            {getCompetitionStatusLabel(competition.status)}
                          </Badge>
                          {competition.status === 'published' ? (
                            <span className="text-xs text-muted-foreground">{getCompetitionPhaseLabel(competition.phase)}</span>
                          ) : null}
                        </div>
                      </TableCell>
                      {canManage ? (
                        <TableCell>
                          <CompetitionActions competition={competition} articleOptions={articleOptions} />
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
