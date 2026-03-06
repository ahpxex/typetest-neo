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
import { formatDateTime } from '@/lib/format'
import { AppSearchParams, getSearchParamValue } from '@/lib/search-params'

export default async function AdminStudentsPage({ searchParams }: { searchParams?: AppSearchParams }) {
  const params = (await searchParams) ?? {}
  const success = getSearchParamValue(params.success)
  const error = getSearchParamValue(params.error)
  const query = getSearchParamValue(params.query) ?? ''
  const students = await getStudentsList(query)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">学生管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">共 {students.length} 名学生 · 主界面以学生表格为中心，新增与批量导入通过弹窗完成。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CreateStudentDialog />
          <ImportStudentsDialog />
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
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden pt-6">
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
                      <Badge variant={student.status === 'active' ? 'secondary' : 'outline'}>{student.status}</Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(student.updatedAt)}</TableCell>
                    <TableCell>
                      <form action={updateStudentStatusAction} className="flex gap-2">
                        <input type="hidden" name="redirectTo" value={`/admin/students${query ? `?query=${encodeURIComponent(query)}` : ''}`} />
                        <input type="hidden" name="studentId" value={student.id} />
                        <input type="hidden" name="status" value={student.status === 'active' ? 'inactive' : 'active'} />
                        <Button type="submit" variant="outline" size="sm">设为{student.status === 'active' ? '停用' : '启用'}</Button>
                      </form>
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

function CreateStudentDialog() {
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
          <input type="hidden" name="redirectTo" value="/admin/students" />
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

function ImportStudentsDialog() {
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
          <input type="hidden" name="redirectTo" value="/admin/students" />
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
