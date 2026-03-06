import Link from 'next/link';

import { logoutAction } from '@/features/auth/actions';
import { APP_NAME } from '@/lib/env';

type AdminShellProps = {
  adminName: string;
  children: React.ReactNode;
};

const navItems = [
  { href: '/admin', label: '总览' },
  { href: '/admin/classes', label: '班级' },
  { href: '/admin/students', label: '学生' },
  { href: '/admin/articles', label: '文章' },
  { href: '/admin/campaigns', label: '场次' },
  { href: '/admin/attempts', label: '成绩' },
  { href: '/admin/export', label: '导出' },
];

export function AdminShell({ adminName, children }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-6">
        <aside className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-6">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-zinc-400">Admin</p>
            <h1 className="mt-2 text-lg font-semibold">{APP_NAME}</h1>
            <p className="mt-1 text-sm text-zinc-500">当前管理员：{adminName}</p>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-xl px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <form action={logoutAction} className="mt-6 border-t border-zinc-200 pt-4">
            <button
              type="submit"
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100"
            >
              退出登录
            </button>
          </form>
        </aside>

        <main className="space-y-6">{children}</main>
      </div>
    </div>
  );
}
