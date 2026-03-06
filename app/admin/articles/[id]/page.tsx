import { redirect } from 'next/navigation'

export default async function ArticleDetailPage() {
  redirect('/admin/campaigns')
}
