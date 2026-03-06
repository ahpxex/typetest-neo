import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createClassGroupAction } from '@/features/admin/actions'
import { getClassGroupsList } from '@/lib/data/queries'
import { formatDateTime } from '@/lib/format'
import { AppSearchParams, getSearchParamValue } from '@/lib/search-params'

export default async function AdminClassesPage({ searchParams }: { searchParams?: AppSearchParams }) {
  const params = (await searchParams) ?? {}
  const success = getSearchParamValue(params.success)
  const error = getSearchParamValue(params.error)
  const classGroups = await getClassGroupsList()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">班级管理</h1>
        <p className="mt-2 text-sm text-muted-foreground">维护年级、专业和班级编码，供学生归档与排行榜使用。</p>
      </header>

      {success ? <Alert><AlertTitle>操作成功</AlertTitle><AlertDescription>{success}</AlertDescription></Alert> : null}
      {error ? <Alert variant="destructive"><AlertTitle>操作失败</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card>
          <CardHeader><CardTitle>新建班级</CardTitle></CardHeader>
          <CardContent>
            <form action={createClassGroupAction} className="space-y-4">
              <input type="hidden" name="redirectTo" value="/admin/classes" />
              <div className="space-y-2"><Label htmlFor="code">班级编码</Label><Input id="code" name="code" placeholder="例如 2026-CS-01" required /></div>
              <div className="space-y-2"><Label htmlFor="name">班级名称</Label><Input id="name" name="name" placeholder="例如 2026 计算机 1 班" required /></div>
              <div className="space-y-2"><Label htmlFor="gradeYear">年级</Label><Input id="gradeYear" name="gradeYear" type="number" placeholder="2026" required /></div>
              <div className="space-y-2"><Label htmlFor="department">学院 / 部门</Label><Input id="department" name="department" placeholder="请输入学院" required /></div>
              <div className="space-y-2"><Label htmlFor="major">专业</Label><Input id="major" name="major" placeholder="请输入专业" required /></div>
              <Button type="submit" className="w-full">保存班级</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>班级列表</CardTitle>
            <CardDescription>共 {classGroups.length} 个班级</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>编码</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>专业</TableHead>
                  <TableHead>人数</TableHead>
                  <TableHead>更新时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classGroups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">{group.code}</TableCell>
                    <TableCell>{group.name}</TableCell>
                    <TableCell>{group.department} / {group.major}</TableCell>
                    <TableCell>{group.studentCount}</TableCell>
                    <TableCell>{formatDateTime(group.updatedAt)}</TableCell>
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
