import { AdminShell } from '@/components/layout/admin-shell';
import { requireAdmin } from '@/lib/auth/guards';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireAdmin();

  return <AdminShell adminName={admin.displayName}>{children}</AdminShell>;
}
