import { redirect } from 'next/navigation'

export default async function AdminExportPage() {
  redirect('/admin/attempts')
}
