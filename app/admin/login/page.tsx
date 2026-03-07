import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminLoginForm } from '@/features/auth/admin-login-form'
import { getCurrentAdmin } from '@/lib/auth/session'

export default async function AdminLoginPage() {
  const currentAdmin = await getCurrentAdmin()

  if (currentAdmin) {
    redirect('/admin')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="grid w-full max-w-4xl gap-6 lg:grid-cols-[1fr_420px]">
        <section className="rounded-[2rem] border border-border bg-card p-10 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Admin Portal</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">管理员后台</h1>
          <p className="mt-4 max-w-xl text-base leading-8 text-muted-foreground">
            在这里统一管理学生名单、查看学生成绩，并导出完整 CSV 数据。
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>学生管理</CardTitle>
                <CardDescription>支持手动录入与批量导入学生名单。</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">支持校园邮箱维护、状态控制，以及按学生查看成绩。</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>成绩导出</CardTitle>
                <CardDescription>在学生列表中查看成绩明细，并导出完整数据。</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">后台只保留一个核心页面，减少切换成本。</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <Card className="rounded-[2rem]">
          <CardHeader>
            <CardTitle>管理员登录</CardTitle>
            <CardDescription>请输入后台账号和密码。</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminLoginForm />
            <div className="mt-6 text-sm text-muted-foreground">
              返回学生登录首页：
              <Link href="/" className="font-semibold text-foreground underline underline-offset-4">
                进入学生端
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
