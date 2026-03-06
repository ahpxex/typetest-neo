import { Card } from '@/components/ui/card';
import { SubmitButton } from '@/components/ui/submit-button';
import { saveArticleAction } from '@/features/admin/actions';

export default function NewArticlePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">新建文章</h1>
        <p className="mt-2 text-sm text-zinc-500">录入新的打字题目并决定是否立即发布。</p>
      </header>

      <Card>
        <ArticleForm redirectTo="/admin/articles" />
      </Card>
    </div>
  );
}

type ArticleFormValue = {
  title?: string;
  slug?: string;
  language?: 'en' | 'zh';
  difficultyLevel?: number;
  status?: 'draft' | 'published' | 'archived';
  source?: string | null;
  contentRaw?: string;
};

function ArticleForm({ article, redirectTo }: { article?: ArticleFormValue; redirectTo: string }) {
  return (
    <form action={saveArticleAction} className="space-y-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="标题" name="title" defaultValue={article?.title} placeholder="请输入文章标题" />
        <Field label="Slug（可选）" name="slug" defaultValue={article?.slug} placeholder="为空时自动生成" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <SelectField label="语言" name="language" defaultValue={article?.language ?? 'en'} options={[['en', '英文'], ['zh', '中文']]} />
        <Field label="难度" name="difficultyLevel" type="number" defaultValue={article?.difficultyLevel ?? 1} placeholder="1-5" />
        <SelectField label="状态" name="status" defaultValue={article?.status ?? 'draft'} options={[['draft', '草稿'], ['published', '已发布'], ['archived', '已归档']]} />
      </div>
      <Field label="来源（可选）" name="source" defaultValue={article?.source} placeholder="教材、人工整理、历史库等" />
      <label className="block space-y-2 text-sm font-medium text-zinc-700">
        <span>正文</span>
        <textarea name="contentRaw" rows={18} defaultValue={article?.contentRaw} className="w-full rounded-2xl border border-zinc-200 px-3 py-3 outline-none transition focus:border-zinc-900" required />
      </label>
      <SubmitButton>{article ? '保存文章' : '创建文章'}</SubmitButton>
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
