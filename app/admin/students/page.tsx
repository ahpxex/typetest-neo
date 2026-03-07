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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { createStudentAction, importStudentsCsvAction, updateStudentStatusAction } from '@/features/admin/actions'
import { getStudentsList } from '@/lib/data/queries'
import { formatDateTime, formatDurationSeconds, formatKpm, formatPercent } from '@/lib/format'
import { AppSearchParams, getSearchParamValue } from '@/lib/search-params'

export default async function AdminStudentsPage({ searchParams }: { searchParams?: AppSearchParams }) {
  const params = (await searchParams) ?? {}
  const success = getSearchParamValue(params.success)
  const error = getSearchParamValue(params.error)
  const query = getSearchParamValue(params.query) ?? ''
  const redirectTo = `/admin/students${query ? `?query=${encodeURIComponent(query)}` : ''}`
  const students = await getStudentsList(query)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">学生管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">共 {students.length} 名学生 · 行内展示最佳速度，详细成绩通过弹窗查看。</p>
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
                {students.map((student) => (
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
        </CardContent>
      </Card>
    </div>
  )
}

function StudentScoresDialog({ student }: { student: Awaited<ReturnType<typeof getStudentsList>>[number] }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">查看成绩</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{student.name} · 成绩详情</DialogTitle>
          <DialogDescription>{student.studentNo} · {student.campusEmail}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard label="最佳速度" value={student.bestSubmittedScoreKpm === null ? '—' : formatKpm(student.bestSubmittedScoreKpm)} />
          <MetricCard label="最佳准确率" value={student.bestSubmittedAccuracy === null ? '—' : formatPercent(student.bestSubmittedAccuracy)} />
          <MetricCard label="已提交次数" value={`${student.submittedAttemptCount}`} />
          <MetricCard label="总记录数" value={`${student.totalAttemptCount}`} />
        </div>

        {student.attempts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            该学生还没有成绩记录。
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>次数</TableHead>
                  <TableHead>文章</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>速度</TableHead>
                  <TableHead>正确率</TableHead>
                  <TableHead>用时</TableHead>
                  <TableHead>提交时间</TableHead>
                  <TableHead>异常</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {student.attempts.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell>{attempt.attemptNo}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{attempt.articleTitle}</TableCell>
                    <TableCell>
                      <Badge variant={attempt.status === 'submitted' ? 'secondary' : 'outline'}>{attempt.status}</Badge>
                    </TableCell>
                    <TableCell>{attempt.status === 'submitted' ? formatKpm(attempt.scoreKpm) : '—'}</TableCell>
                    <TableCell>{attempt.status === 'submitted' ? formatPercent(attempt.accuracy) : '—'}</TableCell>
                    <TableCell>{attempt.durationSecondsUsed ? formatDurationSeconds(attempt.durationSecondsUsed) : formatDurationSeconds(attempt.durationSecondsAllocated)}</TableCell>
                    <TableCell>{formatDateTime(attempt.submittedAt ?? attempt.startedAt)}</TableCell>
                    <TableCell>
                      {attempt.suspicionFlags.length === 0 ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        <div className="space-y-1">
                          {attempt.suspicionFlags.map((flag) => (
                            <Badge key={flag} variant="outline">{flag}</Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
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
