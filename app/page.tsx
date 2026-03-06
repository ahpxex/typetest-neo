import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StudentLoginForm } from '@/features/auth/student-login-form'
import { devLoginAdminAction, devLoginStudentAction } from '@/features/auth/actions'
import { getAnySignedInUser } from '@/lib/auth/guards'
import { APP_NAME, isDevelopment } from '@/lib/env'

export default async function HomePage() {
  const currentUser = await getAnySignedInUser()

  if (currentUser?.type === 'admin') {
    redirect('/admin')
  }

  if (currentUser?.type === 'student') {
    redirect('/typing')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{APP_NAME}</CardTitle>
          <CardDescription>请输入学号、姓名和学校登记的校园邮箱。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <StudentLoginForm />

          {isDevelopment ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Development</p>
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
        </CardContent>
      </Card>
    </main>
  )
}
