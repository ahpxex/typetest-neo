import { Card } from '@/components/ui/card';
import { NoticeBanner } from '@/components/ui/notice-banner';
import { SubmitButton } from '@/components/ui/submit-button';
import { createClassGroupAction } from '@/features/admin/actions';
import { getClassGroupsList } from '@/lib/data/queries';
import { formatDateTime } from '@/lib/format';
import { AppSearchParams, getSearchParamValue } from '@/lib/search-params';

export default async function AdminClassesPage({ searchParams }: { searchParams?: AppSearchParams }) {
  const params = (await searchParams) ?? {};
  const success = getSearchParamValue(params.success);
  const error = getSearchParamValue(params.error);
  const classGroups = await getClassGroupsList();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">班级管理</h1>
        <p className="mt-2 text-sm text-zinc-500">维护年级、专业和班级编码，供学生归档与排行榜使用。</p>
      </header>

      <NoticeBanner message={success} tone="success" />
      <NoticeBanner message={error} tone="error" />

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card title="新建班级">
          <form action={createClassGroupAction} className="space-y-4">
            <input type="hidden" name="redirectTo" value="/admin/classes" />
            <Field label="班级编码" name="code" placeholder="例如 2026-CS-01" />
            <Field label="班级名称" name="name" placeholder="例如 2026 计算机 1 班" />
            <Field label="年级" name="gradeYear" placeholder="2026" type="number" />
            <Field label="学院/部门" name="department" placeholder="请输入学院" />
            <Field label="专业" name="major" placeholder="请输入专业" />
            <SubmitButton className="w-full">保存班级</SubmitButton>
          </form>
        </Card>

        <Card title="班级列表" description={`共 ${classGroups.length} 个班级`}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-zinc-500">
                <tr>
                  <th className="pb-3">编码</th>
                  <th className="pb-3">名称</th>
                  <th className="pb-3">专业</th>
                  <th className="pb-3">人数</th>
                  <th className="pb-3">更新时间</th>
                </tr>
              </thead>
              <tbody>
                {classGroups.map((group) => (
                  <tr key={group.id} className="border-t border-zinc-100">
                    <td className="py-3 font-medium text-zinc-950">{group.code}</td>
                    <td className="py-3">{group.name}</td>
                    <td className="py-3">{group.department} / {group.major}</td>
                    <td className="py-3">{group.studentCount}</td>
                    <td className="py-3">{formatDateTime(group.updatedAt)}</td>
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
