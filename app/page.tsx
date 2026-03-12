import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { devLoginAdminAction, devLoginStudentAction } from '@/features/auth/actions'
import { StudentLoginForm } from '@/features/auth/student-login-form'
import { getAnySignedInUser } from '@/lib/auth/guards'
import { APP_NAME, isDevelopment } from '@/lib/env'
import { AppSearchParams, getSearchParamValue } from '@/lib/search-params'

export default async function HomePage({ searchParams }: { searchParams?: AppSearchParams }) {
  const currentUser = await getAnySignedInUser()

  if (currentUser?.type === 'admin') {
    redirect('/admin')
  }

  if (currentUser?.type === 'student') {
    redirect('/typing')
  }

  const params = (await searchParams) ?? {}
  const success = getSearchParamValue(params.success)
  const error = getSearchParamValue(params.error)

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(172,53,50,0.10),_transparent_38%),linear-gradient(180deg,_rgba(255,250,249,0.96),_rgba(255,255,255,1))] px-4 py-10">
      <div className="w-full max-w-md">
        <Card className="rounded-[2rem] border-border/70 bg-card/95 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle>{APP_NAME}</CardTitle>
            <CardDescription>请输入校园邮箱和密码登录学生端。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {success ? (
              <Alert>
                <AlertTitle>操作成功</AlertTitle>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            ) : null}

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>操作失败</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <StudentLoginForm />

            {isDevelopment ? (
              <div className="space-y-3 rounded-2xl border border-dashed border-border bg-muted/30 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Development</p>
                  <p className="mt-1 text-sm text-muted-foreground">保留开发环境快捷入口，方便本地调试流程。</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <form action={devLoginStudentAction}>
                    <Button type="submit" variant="outline" className="w-full">一键登录学生端</Button>
                  </form>
                  <form action={devLoginAdminAction}>
                    <Button type="submit" variant="outline" className="w-full">一键登录管理员</Button>
                  </form>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <div>
                还没有账号？
                <Link href="/register" className="ml-1 font-semibold text-foreground underline underline-offset-4">
                  前往注册
                </Link>
              </div>
              <div>
                管理员入口：
                <Link href="/admin/login" className="ml-1 font-semibold text-foreground underline underline-offset-4">
                  进入后台
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
