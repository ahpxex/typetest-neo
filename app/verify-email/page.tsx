import Link from 'next/link'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { VerifyEmailTokenForm } from '@/features/auth/verify-email-token-form'
import { AppSearchParams, getSearchParamValue } from '@/lib/search-params'

export default async function VerifyEmailPage({ searchParams }: { searchParams?: AppSearchParams }) {
  const params = (await searchParams) ?? {}
  const token = getSearchParamValue(params.token)
  const success = getSearchParamValue(params.success)
  const error = getSearchParamValue(params.error)

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(172,53,50,0.10),_transparent_42%),linear-gradient(180deg,_rgba(255,251,250,0.95),_rgba(255,255,255,1))] px-4 py-10">
      <Card className="w-full max-w-lg rounded-[2rem] border-border/70 bg-card/95 shadow-sm backdrop-blur">
        <CardHeader>
          <CardTitle>确认校园邮箱</CardTitle>
          <CardDescription>系统正在核验你的注册确认链接，确认成功后会自动进入学生端。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {success ? (
            <Alert>
              <AlertTitle>确认成功</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>确认失败</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {!success && !error && token ? <VerifyEmailTokenForm token={token} /> : null}

          {!success && !error && !token ? (
            <Alert variant="destructive">
              <AlertTitle>确认链接不完整</AlertTitle>
              <AlertDescription>当前页面缺少确认 token，请重新打开邮件中的完整链接。</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <Link href="/" className="font-semibold text-foreground underline underline-offset-4">
              返回登录
            </Link>
            <Link href="/register" className="font-semibold text-foreground underline underline-offset-4">
              返回注册
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
