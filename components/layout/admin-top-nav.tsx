'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { logoutAction } from '@/features/auth/actions'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/admin', label: '学生管理' },
  { href: '/admin/articles', label: '文章管理' },
  { href: '/admin/competitions', label: '竞赛管理' },
] as const

function isActive(pathname: string | null, href: string) {
  if (!pathname) {
    return false
  }
  if (href === '/admin') {
    return pathname === '/admin'
  }
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

        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive(pathname, item.href)
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">退出登录</Button>
          </form>
        </div>
      </div>
    </header>
  )
}
