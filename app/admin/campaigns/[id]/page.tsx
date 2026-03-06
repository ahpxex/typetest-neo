import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { NoticeBanner } from '@/components/ui/notice-banner';
import { SubmitButton } from '@/components/ui/submit-button';
import { saveCampaignAction, setCurrentArticleAction } from '@/features/admin/actions';
import {
  getArticlesList,
  getCampaignArticleAssignments,
  getCampaignById,
  getLatestCampaignCurrentArticle,
  getLeaderboard,
} from '@/lib/data/queries';
import { formatDateTime, formatDurationSeconds, formatKpm, formatPercent } from '@/lib/format';
import { AppSearchParams, getSearchParamValue } from '@/lib/search-params';

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: AppSearchParams;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const campaignId = Number(id);
  const [campaign, articles, articleAssignments, currentArticle, leaderboard] = await Promise.all([
    getCampaignById(campaignId),
    getArticlesList(),
    getCampaignArticleAssignments(campaignId),
    getLatestCampaignCurrentArticle(campaignId),
    getLeaderboard(campaignId),
  ]);

  if (!campaign) {
    notFound();
  }

  const success = getSearchParamValue(resolvedSearchParams?.success);
  const error = getSearchParamValue(resolvedSearchParams?.error);
  const selectedArticleIds = new Set(articleAssignments.map((item) => item.articleId));

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">{campaign.name}</h1>
          <Badge tone={campaign.status === 'active' ? 'success' : campaign.status === 'draft' ? 'warning' : 'default'}>{campaign.status}</Badge>
        </div>
        <p className="text-sm text-zinc-500">{campaign.academicYear} / {campaign.term} · {campaign.mode} · {formatDurationSeconds(campaign.durationSeconds)}</p>
      </header>

      <NoticeBanner message={success} tone="success" />
      <NoticeBanner message={error} tone="error" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card title="编辑场次">
          <form action={saveCampaignAction} className="space-y-5">
            <input type="hidden" name="id" value={campaign.id} />
            <input type="hidden" name="redirectTo" value={`/admin/campaigns/${campaign.id}`} />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="场次名称" name="name" defaultValue={campaign.name} placeholder="请输入场次名称" />
              <Field label="学年" name="academicYear" defaultValue={campaign.academicYear} placeholder="例如 2025-2026" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="学期" name="term" defaultValue={campaign.term} placeholder="例如 fall" />
              <SelectField label="模式" name="mode" defaultValue={campaign.mode} options={[['exam', '考试'], ['practice', '练习']]} />
              <SelectField label="状态" name="status" defaultValue={campaign.status} options={[['draft', '草稿'], ['scheduled', '待开放'], ['active', '激活'], ['closed', '关闭'], ['archived', '归档']]} />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="时长（秒）" name="durationSeconds" type="number" defaultValue={campaign.durationSeconds} placeholder="180" />
              <Field label="最大尝试次数" name="maxAttemptsPerStudent" type="number" defaultValue={campaign.maxAttemptsPerStudent} placeholder="1" />
              <SelectField label="排行榜可见性" name="rankingVisibility" defaultValue={campaign.rankingVisibility} options={[['public', '公开'], ['class_only', '仅班级'], ['hidden', '隐藏']]} />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <SelectField label="出题策略" name="articleStrategy" defaultValue={campaign.articleStrategy} options={[['fixed', '固定文章'], ['daily_random', '每日随机'], ['shuffle_once', '随机锁定']]} />
              <Field label="开始时间" name="startAt" type="datetime-local" defaultValue={campaign.startAt ? toDateTimeLocal(campaign.startAt) : ''} placeholder="" />
              <Field label="结束时间" name="endAt" type="datetime-local" defaultValue={campaign.endAt ? toDateTimeLocal(campaign.endAt) : ''} placeholder="" />
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              <input type="checkbox" name="allowRetry" defaultChecked={campaign.allowRetry} className="size-4 rounded border-zinc-300" />
              允许学生重复测试
            </label>
            <div className="space-y-3 rounded-2xl border border-zinc-200 p-4">
              <div>
                <h2 className="font-semibold text-zinc-950">绑定文章</h2>
                <p className="text-sm text-zinc-500">此场次可使用的文章集合。</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {articles.map((article) => (
                  <label key={article.id} className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                    <input type="checkbox" name="articleIds" value={article.id} defaultChecked={selectedArticleIds.has(article.id)} className="mt-1 size-4 rounded border-zinc-300" />
                    <span>
                      <span className="block font-medium text-zinc-950">{article.title}</span>
                      <span className="text-xs text-zinc-400">{article.language} · {article.status}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <label className="block space-y-2 text-sm font-medium text-zinc-700">
              <span>当前文章（保存时可同时更新）</span>
              <select name="currentArticleId" defaultValue={currentArticle?.articleId ?? ''} className="w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none transition focus:border-zinc-900">
                <option value="">按策略自动决定</option>
                {articleAssignments.map((article) => <option key={article.articleId} value={article.articleId}>{article.title}</option>)}
              </select>
            </label>
            <SubmitButton>保存场次</SubmitButton>
          </form>
        </Card>

        <div className="space-y-6">
          <Card title="当前文章">
            <div className="space-y-3 text-sm text-zinc-600">
              <p>最近解析结果：{currentArticle ? `#${currentArticle.articleId}` : '暂无'}</p>
              <p>最近更新时间：{formatDateTime(currentArticle?.createdAt)}</p>
              <form action={setCurrentArticleAction} className="space-y-3">
                <input type="hidden" name="redirectTo" value={`/admin/campaigns/${campaign.id}`} />
                <input type="hidden" name="campaignId" value={campaign.id} />
                <select name="articleId" defaultValue={currentArticle?.articleId ?? articleAssignments[0]?.articleId ?? ''} className="w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none transition focus:border-zinc-900">
                  {articleAssignments.map((article) => <option key={article.articleId} value={article.articleId}>{article.title}</option>)}
                </select>
                <SubmitButton className="w-full">手动切换当前文章</SubmitButton>
              </form>
            </div>
          </Card>

          <Card title="排行榜预览" description={`当前有 ${leaderboard.length} 名学生进入榜单`}>
            <div className="space-y-3">
              {leaderboard.slice(0, 8).map((entry) => (
                <div key={entry.studentId} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-zinc-950">#{entry.rank} {entry.name}</p>
                    <p className="text-xs text-zinc-400">{entry.studentNo} · {entry.classCode ?? '未分班'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-zinc-950">{formatKpm(entry.scoreKpm)}</p>
                    <p className="text-xs text-zinc-400">{formatPercent(entry.accuracy)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, name, placeholder, defaultValue, type = 'text' }: { label: string; name: string; placeholder: string; defaultValue?: string | number | null; type?: string }) {
  return (
    <label className="block space-y-2 text-sm font-medium text-zinc-700">
      <span>{label}</span>
      <input name={name} type={type} defaultValue={defaultValue ?? ''} placeholder={placeholder} className="w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none transition focus:border-zinc-900" />
    </label>
  );
}

function SelectField({ label, name, defaultValue, options }: { label: string; name: string; defaultValue?: string; options: Array<[string, string]> }) {
  return (
    <label className="block space-y-2 text-sm font-medium text-zinc-700">
      <span>{label}</span>
      <select name={name} defaultValue={defaultValue} className="w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none transition focus:border-zinc-900">
        {options.map(([value, labelText]) => <option key={value} value={value}>{labelText}</option>)}
      </select>
    </label>
  );
}

function toDateTimeLocal(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
