'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { logoutAction } from '@/features/auth/actions'

export function AdminTopNav({ adminName }: { adminName: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Admin</p>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">社科大打字测试系统</h1>
            <p className="text-sm text-muted-foreground">当前管理员：{adminName}</p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary" size="sm" className="rounded-full border border-border bg-muted px-4 text-foreground shadow-none hover:bg-muted">
            <Link href="/admin/students">学生</Link>
          </Button>
        </nav>

        <form action={logoutAction}>
          <Button type="submit" variant="outline" size="sm">退出登录</Button>
        </form>
      </div>
    </header>
  )
}
