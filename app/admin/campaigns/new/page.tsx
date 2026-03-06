import { Card } from '@/components/ui/card';
import { SubmitButton } from '@/components/ui/submit-button';
import { saveCampaignAction } from '@/features/admin/actions';
import { getArticlesList } from '@/lib/data/queries';

export default async function NewCampaignPage() {
  const articles = await getArticlesList();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">新建场次</h1>
        <p className="mt-2 text-sm text-zinc-500">创建新的测试活动，并绑定文章与出题策略。</p>
      </header>

      <Card>
        <CampaignForm redirectTo="/admin/campaigns" articles={articles} />
      </Card>
    </div>
  );
}

type CampaignArticleOption = {
  id: number;
  title: string;
  language: 'en' | 'zh';
  status: 'draft' | 'published' | 'archived';
  charCount: number;
};

type CampaignFormValue = {
  name?: string;
  academicYear?: string;
  term?: string;
  mode?: 'practice' | 'exam';
  status?: 'draft' | 'scheduled' | 'active' | 'closed' | 'archived';
  durationSeconds?: number;
  maxAttemptsPerStudent?: number;
  rankingVisibility?: 'public' | 'class_only' | 'hidden';
  articleStrategy?: 'fixed' | 'daily_random' | 'shuffle_once';
  startAt?: Date | null;
  endAt?: Date | null;
  allowRetry?: boolean;
  currentArticleId?: number | null;
  articleAssignments?: Array<{ articleId: number }>;
};

function CampaignForm({ campaign, articles, redirectTo }: { campaign?: CampaignFormValue; articles: CampaignArticleOption[]; redirectTo: string }) {
  const selectedArticleIds = new Set<number>((campaign?.articleAssignments ?? []).map((item) => item.articleId));
  return (
    <form action={saveCampaignAction} className="space-y-5">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="场次名称" name="name" defaultValue={campaign?.name} placeholder="例如 2026 大一打字测试" />
        <Field label="学年" name="academicYear" defaultValue={campaign?.academicYear} placeholder="例如 2025-2026" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="学期" name="term" defaultValue={campaign?.term ?? 'fall'} placeholder="例如 fall / spring" />
        <SelectField label="模式" name="mode" defaultValue={campaign?.mode ?? 'exam'} options={[['exam', '考试'], ['practice', '练习']]} />
        <SelectField label="状态" name="status" defaultValue={campaign?.status ?? 'draft'} options={[['draft', '草稿'], ['scheduled', '待开放'], ['active', '激活'], ['closed', '关闭'], ['archived', '归档']]} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="时长（秒）" name="durationSeconds" type="number" defaultValue={campaign?.durationSeconds ?? 180} placeholder="180" />
        <Field label="最大尝试次数" name="maxAttemptsPerStudent" type="number" defaultValue={campaign?.maxAttemptsPerStudent ?? 1} placeholder="1" />
        <SelectField label="排行榜可见性" name="rankingVisibility" defaultValue={campaign?.rankingVisibility ?? 'public'} options={[['public', '公开'], ['class_only', '仅班级'], ['hidden', '隐藏']]} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <SelectField label="出题策略" name="articleStrategy" defaultValue={campaign?.articleStrategy ?? 'fixed'} options={[['fixed', '固定文章'], ['daily_random', '每日随机'], ['shuffle_once', '随机锁定']]} />
        <Field label="开始时间（可选）" name="startAt" type="datetime-local" defaultValue={campaign?.startAt ? toDateTimeLocal(campaign.startAt) : ''} placeholder="" />
        <Field label="结束时间（可选）" name="endAt" type="datetime-local" defaultValue={campaign?.endAt ? toDateTimeLocal(campaign.endAt) : ''} placeholder="" />
      </div>
      <label className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
        <input type="checkbox" name="allowRetry" defaultChecked={campaign?.allowRetry ?? false} className="size-4 rounded border-zinc-300" />
        允许学生重复测试（但仍受最大次数限制）
      </label>
      <div className="space-y-3 rounded-2xl border border-zinc-200 p-4">
        <div>
          <h2 className="font-semibold text-zinc-950">绑定文章</h2>
          <p className="text-sm text-zinc-500">至少选择一篇文章用于当前场次。</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {articles.map((article) => (
            <label key={article.id} className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              <input type="checkbox" name="articleIds" value={article.id} defaultChecked={selectedArticleIds.has(article.id)} className="mt-1 size-4 rounded border-zinc-300" />
              <span>
                <span className="block font-medium text-zinc-950">{article.title}</span>
                <span className="text-xs text-zinc-400">{article.language} · {article.status} · {article.charCount} chars</span>
              </span>
            </label>
          ))}
        </div>
      </div>
      <label className="block space-y-2 text-sm font-medium text-zinc-700">
        <span>当前文章（可选）</span>
        <select name="currentArticleId" defaultValue={campaign?.currentArticleId ?? ''} className="w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none transition focus:border-zinc-900">
          <option value="">按策略自动决定</option>
          {articles.map((article) => <option key={article.id} value={article.id}>{article.title}</option>)}
        </select>
      </label>
      <SubmitButton>{campaign ? '保存场次' : '创建场次'}</SubmitButton>
    </form>
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
