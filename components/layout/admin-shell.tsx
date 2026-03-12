import { SessionKeepAlive } from '@/components/auth/session-keepalive'
import { AdminTopNav } from '@/components/layout/admin-top-nav'

type AdminShellProps = {
  adminName: string
  children: React.ReactNode
}

export function AdminShell({ adminName, children }: AdminShellProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <SessionKeepAlive userType="admin" />
      <AdminTopNav adminName={adminName} />
      <main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 overflow-hidden px-4 py-4 md:px-6 md:py-5">
        {children}
      </main>
    </div>
  )
}
