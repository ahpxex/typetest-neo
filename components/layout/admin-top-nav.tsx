'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { logoutAction } from '@/features/auth/actions'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/admin/students', label: '学生' },
  { href: '/admin/campaigns', label: '场次' },
  { href: '/admin/attempts', label: '成绩' },
  { href: '/admin/export', label: '导出' },
]

function isActiveTab(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AdminTopNav({ adminName }: { adminName: string }) {
  const pathname = usePathname()

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
          {tabs.map((tab) => {
            const active = isActiveTab(pathname, tab.href)
            return (
              <Button
                key={tab.href}
                asChild
                variant={active ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  'rounded-full px-4',
                  active
                    ? 'border border-border bg-muted text-foreground shadow-none hover:bg-muted'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Link href={tab.href}>{tab.label}</Link>
              </Button>
            )
          })}
        </nav>

        <form action={logoutAction}>
          <Button type="submit" variant="outline" size="sm">退出登录</Button>
        </form>
      </div>
    </header>
  )
}
