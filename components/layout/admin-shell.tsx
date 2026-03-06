import { AdminTopNav } from '@/components/layout/admin-top-nav'

type AdminShellProps = {
  adminName: string
  children: React.ReactNode
}

export function AdminShell({ adminName, children }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminTopNav adminName={adminName} />
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">{children}</main>
    </div>
  )
}
