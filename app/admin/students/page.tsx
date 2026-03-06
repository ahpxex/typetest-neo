import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { NoticeBanner } from '@/components/ui/notice-banner';
import { SubmitButton } from '@/components/ui/submit-button';
import { createStudentAction, importStudentsCsvAction, updateStudentStatusAction } from '@/features/admin/actions';
import { getClassGroupsList, getStudentsList } from '@/lib/data/queries';
import { AppSearchParams, getSearchParamValue } from '@/lib/search-params';

export default async function AdminStudentsPage({ searchParams }: { searchParams?: AppSearchParams }) {
  const params = (await searchParams) ?? {};
  const success = getSearchParamValue(params.success);
  const error = getSearchParamValue(params.error);
  const query = getSearchParamValue(params.query) ?? '';
  const [classGroups, students] = await Promise.all([getClassGroupsList(), getStudentsList(query)]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">学生管理</h1>
        <p className="mt-2 text-sm text-zinc-500">录入学生、校园邮箱和班级归属，学生端登录会使用这三项精确匹配。</p>
      </header>

      <NoticeBanner message={success} tone="success" />
      <NoticeBanner message={error} tone="error" />

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card title="录入学生">
            <form action={createStudentAction} className="space-y-4">
              <input type="hidden" name="redirectTo" value="/admin/students" />
              <Field label="学号" name="studentNo" placeholder="请输入学号" />
              <Field label="姓名" name="name" placeholder="请输入姓名" />
              <Field label="校园邮箱" name="campusEmail" placeholder="name@ucass.edu.cn" type="email" />
              <label className="block space-y-2 text-sm font-medium text-zinc-700">
                <span>所属班级</span>
                <select name="classGroupId" className="w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none transition focus:border-zinc-900">
                  <option value="">未分配</option>
                  {classGroups.map((group) => (
                    <option key={group.id} value={group.id}>{group.code} · {group.name}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2 text-sm font-medium text-zinc-700">
                <span>备注</span>
                <textarea name="notes" rows={3} className="w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none transition focus:border-zinc-900" />
              </label>
              <SubmitButton className="w-full">保存学生</SubmitButton>
            </form>
          </Card>

          <Card title="批量导入 CSV" description="支持带表头或不带表头：student_no,name,class_code,campus_email">
            <form action={importStudentsCsvAction} className="space-y-4">
              <input type="hidden" name="redirectTo" value="/admin/students" />
              <textarea
                name="csvText"
                rows={10}
                placeholder={'student_no,name,class_code,campus_email\n20260000001,测试学生,DEV-2026-01,student.dev@ucass.edu.cn'}
                className="w-full rounded-2xl border border-zinc-200 px-3 py-3 font-mono text-xs outline-none transition focus:border-zinc-900"
              />
              <SubmitButton className="w-full">导入 CSV</SubmitButton>
            </form>
          </Card>
        </div>

        <Card title="学生列表" description={`当前显示 ${students.length} 名学生`}>
          <form className="mb-4 flex gap-3">
            <input name="query" defaultValue={query} placeholder="按学号、姓名、邮箱或班级搜索" className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-zinc-900" />
            <button type="submit" className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100">搜索</button>
          </form>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-zinc-500">
                <tr>
                  <th className="pb-3">学生</th>
                  <th className="pb-3">校园邮箱</th>
                  <th className="pb-3">班级</th>
                  <th className="pb-3">状态</th>
                  <th className="pb-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-t border-zinc-100 align-top">
                    <td className="py-3">
                      <p className="font-medium text-zinc-950">{student.name}</p>
                      <p className="text-xs text-zinc-400">{student.studentNo}</p>
                    </td>
                    <td className="py-3">{student.campusEmail}</td>
                    <td className="py-3">{student.classCode ? `${student.classCode} · ${student.className}` : '未分配'}</td>
                    <td className="py-3"><Badge tone={student.status === 'active' ? 'success' : 'warning'}>{student.status}</Badge></td>
                    <td className="py-3">
                      <form action={updateStudentStatusAction} className="flex gap-2">
                        <input type="hidden" name="redirectTo" value={`/admin/students${query ? `?query=${encodeURIComponent(query)}` : ''}`} />
                        <input type="hidden" name="studentId" value={student.id} />
                        <input type="hidden" name="status" value={student.status === 'active' ? 'inactive' : 'active'} />
                        <button type="submit" className="rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-100">
                          设为{student.status === 'active' ? '停用' : '启用'}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, name, placeholder, type = 'text' }: { label: string; name: string; placeholder: string; type?: string }) {
  return (
    <label className="block space-y-2 text-sm font-medium text-zinc-700">
      <span>{label}</span>
      <input name={name} type={type} placeholder={placeholder} className="w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none transition focus:border-zinc-900" required />
    </label>
  );
}
