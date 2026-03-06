import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { NoticeBanner } from '@/components/ui/notice-banner';
import { getArticlesList } from '@/lib/data/queries';
import { formatDateTime } from '@/lib/format';
import { AppSearchParams, getSearchParamValue } from '@/lib/search-params';

export default async function AdminArticlesPage({ searchParams }: { searchParams?: AppSearchParams }) {
  const params = (await searchParams) ?? {};
  const success = getSearchParamValue(params.success);
  const error = getSearchParamValue(params.error);
  const articles = await getArticlesList();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">文章题库</h1>
          <p className="mt-2 text-sm text-zinc-500">维护打字题库，支持草稿、发布和归档状态。</p>
        </div>
        <Link href="/admin/articles/new" className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
          新建文章
        </Link>
      </header>

      <NoticeBanner message={success} tone="success" />
      <NoticeBanner message={error} tone="error" />

      <Card title="文章列表" description={`当前共有 ${articles.length} 篇文章`}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="pb-3">标题</th>
                <th className="pb-3">语言</th>
                <th className="pb-3">状态</th>
                <th className="pb-3">字数</th>
                <th className="pb-3">更新时间</th>
                <th className="pb-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.id} className="border-t border-zinc-100">
                  <td className="py-3">
                    <p className="font-medium text-zinc-950">{article.title}</p>
                    <p className="text-xs text-zinc-400">/{article.slug}</p>
                  </td>
                  <td className="py-3">{article.language}</td>
                  <td className="py-3"><Badge tone={article.status === 'published' ? 'success' : article.status === 'draft' ? 'warning' : 'default'}>{article.status}</Badge></td>
                  <td className="py-3">{article.charCount}</td>
                  <td className="py-3">{formatDateTime(article.updatedAt)}</td>
                  <td className="py-3">
                    <Link href={`/admin/articles/${article.id}`} className="rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-100">
                      编辑
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
