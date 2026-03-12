import { redirect } from 'next/navigation'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StudentRegisterForm } from '@/features/auth/student-register-form'
import { getAnySignedInUser } from '@/lib/auth/guards'

export default async function RegisterPage() {
  const currentUser = await getAnySignedInUser()

  if (currentUser?.type === 'admin') {
    redirect('/admin')
  }

  if (currentUser?.type === 'student') {
    redirect('/typing')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(172,53,50,0.10),_transparent_38%),linear-gradient(180deg,_rgba(255,250,249,0.96),_rgba(255,255,255,1))] px-4 py-10">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_420px]">
        <section className="rounded-[2rem] border border-border/70 bg-card/90 p-8 shadow-sm backdrop-blur sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Register</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">先创建账号，再去邮箱点亮它。</h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground">
            注册时请填写真实学号、姓名和校园邮箱。系统会把确认链接发送到你的校园邮箱，只有完成确认之后，才能用邮箱和密码进入学生端。
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Card className="border-border/70 bg-background/75 shadow-none">
              <CardHeader>
                <CardTitle>1. 填写信息</CardTitle>
                <CardDescription>学号、姓名、校园邮箱和密码都在这一页完成。</CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-border/70 bg-background/75 shadow-none">
              <CardHeader>
                <CardTitle>2. 查收邮件</CardTitle>
                <CardDescription>系统会立刻向 `@ucass.edu.cn` 邮箱发送确认邮件。</CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-border/70 bg-background/75 shadow-none">
              <CardHeader>
                <CardTitle>3. 自动进入学生端</CardTitle>
                <CardDescription>确认成功后，系统会直接为你登录并跳转到学生首页。</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        <Card className="rounded-[2rem] border-border/70 bg-card/95 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle>注册校园邮箱账号</CardTitle>
            <CardDescription>确认邮件会发送到你填写的校园邮箱。</CardDescription>
          </CardHeader>
          <CardContent>
            <StudentRegisterForm />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
