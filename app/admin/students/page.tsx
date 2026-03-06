import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { createStudentAction, importStudentsCsvAction, updateStudentStatusAction } from '@/features/admin/actions'
import { getClassGroupsList, getStudentsList } from '@/lib/data/queries'
import { AppSearchParams, getSearchParamValue } from '@/lib/search-params'

export default async function AdminStudentsPage({ searchParams }: { searchParams?: AppSearchParams }) {
  const params = (await searchParams) ?? {}
  const success = getSearchParamValue(params.success)
  const error = getSearchParamValue(params.error)
  const query = getSearchParamValue(params.query) ?? ''
  const [classGroups, students] = await Promise.all([getClassGroupsList(), getStudentsList(query)])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">学生管理</h1>
        <p className="mt-2 text-sm text-muted-foreground">录入学生、校园邮箱和班级归属，学生端登录会使用这三项精确匹配。</p>
      </header>

      {success ? <Alert><AlertTitle>操作成功</AlertTitle><AlertDescription>{success}</AlertDescription></Alert> : null}
      {error ? <Alert variant="destructive"><AlertTitle>操作失败</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>录入学生</CardTitle></CardHeader>
            <CardContent>
              <form action={createStudentAction} className="space-y-4">
                <input type="hidden" name="redirectTo" value="/admin/students" />
                <div className="space-y-2"><Label htmlFor="studentNo">学号</Label><Input id="studentNo" name="studentNo" placeholder="请输入学号" required /></div>
                <div className="space-y-2"><Label htmlFor="studentName">姓名</Label><Input id="studentName" name="name" placeholder="请输入姓名" required /></div>
                <div className="space-y-2"><Label htmlFor="studentEmail">校园邮箱</Label><Input id="studentEmail" name="campusEmail" type="email" placeholder="name@ucass.edu.cn" required /></div>
                <div className="space-y-2">
                  <Label htmlFor="classGroupId">所属班级</Label>
                  <Select name="classGroupId" defaultValue="none">
                    <SelectTrigger id="classGroupId" className="w-full"><SelectValue placeholder="未分配" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">未分配</SelectItem>
                      {classGroups.map((group) => <SelectItem key={group.id} value={String(group.id)}>{group.code} · {group.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label htmlFor="notes">备注</Label><Textarea id="notes" name="notes" rows={3} /></div>
                <Button type="submit" className="w-full">保存学生</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>批量导入 CSV</CardTitle>
              <CardDescription>支持带表头或不带表头：student_no,name,class_code,campus_email</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={importStudentsCsvAction} className="space-y-4">
                <input type="hidden" name="redirectTo" value="/admin/students" />
                <Textarea name="csvText" rows={10} placeholder={'student_no,name,class_code,campus_email\n20260000001,测试学生,DEV-2026-01,student.dev@ucass.edu.cn'} className="font-mono text-xs" />
                <Button type="submit" className="w-full">导入 CSV</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>学生列表</CardTitle>
            <CardDescription>当前显示 {students.length} 名学生</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="mb-4 flex gap-3">
              <Input name="query" defaultValue={query} placeholder="按学号、姓名、邮箱或班级搜索" />
              <Button type="submit" variant="outline">搜索</Button>
            </form>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>学生</TableHead>
                  <TableHead>校园邮箱</TableHead>
                  <TableHead>班级</TableHead>
                  <TableHead>状态</TableHead>
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
                    <TableCell>{student.classCode ? `${student.classCode} · ${student.className}` : '未分配'}</TableCell>
                    <TableCell><Badge variant={student.status === 'active' ? 'secondary' : 'outline'}>{student.status}</Badge></TableCell>
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
