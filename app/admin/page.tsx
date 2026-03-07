import Link from 'next/link'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { StudentScoresDialog } from '@/components/admin/student-scores-dialog'
import { createStudentAction, importStudentsCsvAction, updateStudentStatusAction } from '@/features/admin/actions'
import { ADMIN_STUDENTS_PAGE_SIZE, getAdminStudentsPage } from '@/lib/data/queries'
import { formatDateTime, formatKpm, formatPercent } from '@/lib/format'
import { AppSearchParams, getSearchParamValue } from '@/lib/search-params'

function buildAdminHref(query: string, page: number) {
  const params = new URLSearchParams()

  if (query) {
    params.set('query', query)
  }

  if (page > 1) {
    params.set('page', String(page))
  }

  const search = params.toString()
  return search ? `/admin?${search}` : '/admin'
}

function getPaginationItems(totalPages: number, currentPage: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', totalPages] as const
  }

  if (currentPage >= totalPages - 3) {
    return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const
  }

  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages] as const
}

export default async function AdminPage({ searchParams }: { searchParams?: AppSearchParams }) {
  const params = (await searchParams) ?? {}
  const success = getSearchParamValue(params.success)
  const error = getSearchParamValue(params.error)
  const query = getSearchParamValue(params.query) ?? ''
  const pageParam = Number.parseInt(getSearchParamValue(params.page) ?? '1', 10)
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
  const redirectTo = buildAdminHref(query, page)
  const studentPage = await getAdminStudentsPage({ search: query, page, pageSize: ADMIN_STUDENTS_PAGE_SIZE })
  const rangeStart = studentPage.total === 0 ? 0 : (studentPage.page - 1) * studentPage.pageSize + 1
  const rangeEnd = Math.min(studentPage.total, studentPage.page * studentPage.pageSize)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">学生管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            共 {studentPage.total} 名学生 · 当前显示 {rangeStart}-{rangeEnd} · 每页 {studentPage.pageSize} 条
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/api/export/attempts">导出 CSV</Link>
          </Button>
          <CreateStudentDialog redirectTo={redirectTo} />
          <ImportStudentsDialog redirectTo={redirectTo} />
        </div>
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
          <form className="mb-3 flex shrink-0 gap-3">
            <Input name="query" defaultValue={query} placeholder="按学号、姓名或邮箱搜索" />
            <Button type="submit" variant="outline">搜索</Button>
          </form>

          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>学生</TableHead>
                  <TableHead>校园邮箱</TableHead>
                  <TableHead>最佳速度</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentPage.items.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <p className="font-medium">{student.name}</p>
                      <p className="text-xs text-muted-foreground">{student.studentNo}</p>
                    </TableCell>
                    <TableCell>{student.campusEmail}</TableCell>
                    <TableCell>
                      {student.bestSubmittedScoreKpm === null ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        <div>
                          <p className="font-medium">{formatKpm(student.bestSubmittedScoreKpm)}</p>
                          <p className="text-xs text-muted-foreground">
                            {student.bestSubmittedAccuracy === null ? '暂无准确率' : formatPercent(student.bestSubmittedAccuracy)}
                            {' · '}
                            已提交 {student.submittedAttemptCount} 次
                          </p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.status === 'active' ? 'secondary' : 'outline'}>{student.status}</Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(student.updatedAt)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <StudentScoresDialog student={student} />
                        <form action={updateStudentStatusAction} className="flex gap-2">
                          <input type="hidden" name="redirectTo" value={redirectTo} />
                          <input type="hidden" name="studentId" value={student.id} />
                          <input type="hidden" name="status" value={student.status === 'active' ? 'inactive' : 'active'} />
                          <Button type="submit" variant="outline" size="sm">设为{student.status === 'active' ? '停用' : '启用'}</Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-3 flex shrink-0 flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <p>第 {studentPage.page} / {studentPage.totalPages} 页</p>
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  {studentPage.page > 1 ? (
                    <PaginationPrevious href={buildAdminHref(query, studentPage.page - 1)} />
                  ) : (
                    <span className="inline-flex h-8 items-center justify-center gap-1 rounded-md px-2.5 text-muted-foreground/50">上一页</span>
                  )}
                </PaginationItem>
                {getPaginationItems(studentPage.totalPages, studentPage.page).map((item, index) => (
                  <PaginationItem key={`${item}-${index}`}>
                    {item === 'ellipsis' ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink href={buildAdminHref(query, item)} isActive={item === studentPage.page}>
                        {item}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
                <PaginationItem>
                  {studentPage.page < studentPage.totalPages ? (
                    <PaginationNext href={buildAdminHref(query, studentPage.page + 1)} />
                  ) : (
                    <span className="inline-flex h-8 items-center justify-center gap-1 rounded-md px-2.5 text-muted-foreground/50">下一页</span>
                  )}
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function CreateStudentDialog({ redirectTo }: { redirectTo: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>新增学生</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>新增学生</DialogTitle>
          <DialogDescription>填写学号、姓名和校园邮箱后保存到系统。</DialogDescription>
        </DialogHeader>

        <form action={createStudentAction} className="space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div className="space-y-2"><Label htmlFor="studentNo">学号</Label><Input id="studentNo" name="studentNo" placeholder="请输入学号" required /></div>
          <div className="space-y-2"><Label htmlFor="studentName">姓名</Label><Input id="studentName" name="name" placeholder="请输入姓名" required /></div>
          <div className="space-y-2"><Label htmlFor="studentEmail">校园邮箱</Label><Input id="studentEmail" name="campusEmail" type="email" placeholder="name@ucass.edu.cn" required /></div>
          <div className="space-y-2"><Label htmlFor="notes">备注</Label><Textarea id="notes" name="notes" rows={5} /></div>
          <div className="flex justify-end">
            <Button type="submit">保存学生</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ImportStudentsDialog({ redirectTo }: { redirectTo: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">批量导入</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>批量导入 CSV</DialogTitle>
          <DialogDescription>支持带表头或不带表头：student_no,name,campus_email</DialogDescription>
        </DialogHeader>

        <form action={importStudentsCsvAction} className="space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <Textarea
            name="csvText"
            rows={14}
            placeholder={'student_no,name,campus_email\n20260000001,测试学生,student.dev@ucass.edu.cn'}
            className="font-mono text-xs"
          />
          <div className="flex justify-end">
            <Button type="submit">导入 CSV</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
