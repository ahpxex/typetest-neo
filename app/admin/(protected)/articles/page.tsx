import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArticleForm } from '@/components/admin/article-form'
import { updateArticleStatusAction } from '@/features/admin/article-actions'
import { canManageArticles } from '@/lib/auth/admin-authorization'
import { requireAdmin } from '@/lib/auth/guards'
import { getAdminArticles, type AdminArticleSummary } from '@/lib/data/queries'
import { formatDateTime } from '@/lib/format'
import { AppSearchParams, getSearchParamValue } from '@/lib/search-params'

const ARTICLES_PATH = '/admin/articles'

const statusMeta: Record<AdminArticleSummary['status'], { label: string; variant: 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: '草稿', variant: 'outline' },
  published: { label: '已发布', variant: 'secondary' },
  archived: { label: '已归档', variant: 'destructive' },
}

function StatusButton({
  articleId,
  status,
  label,
  variant = 'outline',
}: {
  articleId: number
  status: 'draft' | 'published' | 'archived'
  label: string
  variant?: 'outline' | 'secondary'
}) {
  return (
    <form action={updateArticleStatusAction}>
      <input type="hidden" name="redirectTo" value={ARTICLES_PATH} />
      <input type="hidden" name="articleId" value={articleId} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant={variant} size="sm">{label}</Button>
    </form>
  )
}

export default async function AdminArticlesPage({ searchParams }: { searchParams?: AppSearchParams }) {
  const { admin } = await requireAdmin()
  const params = (await searchParams) ?? {}
  const success = getSearchParamValue(params.success)
  const error = getSearchParamValue(params.error)
  const canManage = canManageArticles(admin.role)

  const articles = await getAdminArticles()
  const publishedCount = articles.filter((article) => article.status === 'published').length

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">文章管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            共 {articles.length} 篇 · 已发布 {publishedCount} 篇 · 已发布的文章可用于练习、考试与竞赛
          </p>
        </div>
        {canManage ? <ArticleForm redirectTo={ARTICLES_PATH} /> : null}
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

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead>语言/难度</TableHead>
                  <TableHead>字符/词数</TableHead>
                  <TableHead>使用情况</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>更新时间</TableHead>
                  {canManage ? <TableHead>操作</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {articles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 7 : 6} className="py-10 text-center text-sm text-muted-foreground">
                      还没有文章，点击右上角「导入新文章」开始。
                    </TableCell>
                  </TableRow>
                ) : (
                  articles.map((article) => (
                    <TableRow key={article.id}>
                      <TableCell>
                        <p className="font-medium">{article.title}</p>
                        <p className="text-xs text-muted-foreground">{article.slug}</p>
                      </TableCell>
                      <TableCell>
                        <p>{article.language === 'zh' ? '中文' : '英文'}</p>
                        <p className="text-xs text-muted-foreground">难度 {article.difficultyLevel}</p>
                      </TableCell>
                      <TableCell>
                        <p>{article.charCount} 字符</p>
                        <p className="text-xs text-muted-foreground">{article.wordCount} 词</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs text-muted-foreground">作答 {article.attemptCount} 次</p>
                        <p className="text-xs text-muted-foreground">竞赛引用 {article.competitionCount} 个</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusMeta[article.status].variant}>{statusMeta[article.status].label}</Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(article.updatedAt)}</TableCell>
                      {canManage ? (
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {article.status !== 'published' ? (
                              <StatusButton articleId={article.id} status="published" label="发布" variant="secondary" />
                            ) : (
                              <StatusButton articleId={article.id} status="draft" label="下线为草稿" />
                            )}
                            {article.status !== 'archived' ? (
                              <StatusButton articleId={article.id} status="archived" label="归档" />
                            ) : (
                              <StatusButton articleId={article.id} status="draft" label="恢复" />
                            )}
                          </div>
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
