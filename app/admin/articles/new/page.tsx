import { redirect } from 'next/navigation'

export default async function NewArticlePage() {
  redirect('/admin/campaigns')
}
