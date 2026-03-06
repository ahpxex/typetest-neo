import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Card } from '@/components/ui/card';
import { AdminLoginForm } from '@/features/auth/admin-login-form';
import { getCurrentAdmin } from '@/lib/auth/session';

export default async function AdminLoginPage() {
  const currentAdmin = await getCurrentAdmin();

  if (currentAdmin) {
    redirect('/admin');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10">
      <div className="grid w-full max-w-4xl gap-6 lg:grid-cols-[1fr_420px]">
        <section className="rounded-[2rem] border border-zinc-200 bg-white p-10 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-400">Admin Portal</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950">管理员后台</h1>
          <p className="mt-4 max-w-xl text-base leading-8 text-zinc-600">
            在这里统一管理学生名单、题库文章、考试场次、成绩记录与导出操作。
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Card title="学生管理" description="支持手动录入与批量导入学生名单。">
              <p className="text-sm text-zinc-500">支持班级归档、状态控制和邮箱维护。</p>
            </Card>
            <Card title="场次配置" description="设置当前测试、文章策略与排行榜展示。">
              <p className="text-sm text-zinc-500">固定文章、每日随机与随机锁定都能覆盖。</p>
            </Card>
          </div>
        </section>

        <aside className="rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="mb-6 space-y-2">
            <h2 className="text-2xl font-semibold text-zinc-950">管理员登录</h2>
            <p className="text-sm leading-7 text-zinc-500">请输入后台账号和密码。</p>
          </div>

          <AdminLoginForm />

          <div className="mt-6 text-sm text-zinc-500">
            返回学生登录首页：
            <Link href="/" className="font-semibold text-zinc-950 underline underline-offset-4">
              进入学生端
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
