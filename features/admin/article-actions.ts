'use server';

import { eq, like, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { db, withDatabaseRetry } from '@/db/client';
import { articles } from '@/db/schema';
import { canManageArticles } from '@/lib/auth/admin-authorization';
import { getCurrentAdmin } from '@/lib/auth/session';
import { slugify } from '@/lib/format';
import { normalizeTypingText } from '@/modules/typing-engine';
import { getRedirectTarget, redirectWithNotice } from '@/features/admin/action-helpers';

const ARTICLES_PATH = '/admin/articles';

async function requireArticleManagementAdmin(redirectTo: string) {
  const currentAdmin = await getCurrentAdmin();

  if (!currentAdmin) {
    redirect('/admin/login');
  }

  if (!canManageArticles(currentAdmin.admin.role)) {
    redirectWithNotice(redirectTo, 'error', '当前账号没有管理文章的权限。');
  }

  return currentAdmin;
}

const createArticleSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(160, '标题过长'),
  language: z.enum(['en', 'zh']),
  difficultyLevel: z.coerce.number().int().min(1).max(5).default(1),
  status: z.enum(['draft', 'published']).default('published'),
  contentRaw: z.string().trim().min(20, '文章正文太短，至少需要 20 个字符'),
});

function computeArticleMetrics(contentRaw: string, language: 'en' | 'zh') {
  const contentNormalized = normalizeTypingText(contentRaw);
  const charCount = Array.from(contentNormalized).length;
  const wordCount = language === 'zh'
    ? charCount
    : contentNormalized.trim().split(/\s+/).filter(Boolean).length;

  return { contentNormalized, charCount, wordCount };
}

async function ensureUniqueArticleSlug(title: string) {
  const base = slugify(title) || 'article';

  const existing = await withDatabaseRetry('ensureUniqueArticleSlug', async () => (
    db
      .select({ slug: articles.slug })
      .from(articles)
      .where(or(eq(articles.slug, base), like(articles.slug, `${base}-%`)))
  ));

  const taken = new Set(existing.map((row) => row.slug));
  if (!taken.has(base)) {
    return base;
  }

  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  return `${base}-${Date.now()}`;
}

export async function createArticleAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, ARTICLES_PATH);
  await requireArticleManagementAdmin(redirectTo);

  const parsed = createArticleSchema.safeParse({
    title: formData.get('title'),
    language: formData.get('language'),
    difficultyLevel: formData.get('difficultyLevel') || undefined,
    status: formData.get('status') || undefined,
    contentRaw: formData.get('contentRaw'),
  });

  if (!parsed.success) {
    redirectWithNotice(redirectTo, 'error', parsed.error.issues[0]?.message ?? '文章信息不完整');
  }

  const data = parsed.data;
  const { contentNormalized, charCount, wordCount } = computeArticleMetrics(data.contentRaw, data.language);

  if (charCount === 0) {
    redirectWithNotice(redirectTo, 'error', '文章正文为空');
  }

  const slug = await ensureUniqueArticleSlug(data.title);

  await withDatabaseRetry('createArticleAction.insert', async () => {
    await db.insert(articles).values({
      title: data.title,
      slug,
      language: data.language,
      contentRaw: data.contentRaw,
      contentNormalized,
      charCount,
      wordCount,
      difficultyLevel: data.difficultyLevel,
      status: data.status,
      source: 'admin:manual',
    });
  });

  revalidatePath(ARTICLES_PATH);
  revalidatePath('/admin/competitions');
  redirectWithNotice(redirectTo, 'success', `文章「${data.title}」已${data.status === 'published' ? '导入并发布' : '保存为草稿'}`);
}

export async function updateArticleStatusAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, ARTICLES_PATH);
  await requireArticleManagementAdmin(redirectTo);

  const articleId = z.coerce.number().int().positive().safeParse(formData.get('articleId'));
  const status = z.enum(['draft', 'published', 'archived']).safeParse(formData.get('status'));

  if (!articleId.success || !status.success) {
    redirectWithNotice(redirectTo, 'error', '请求参数不合法');
  }

  await withDatabaseRetry('updateArticleStatusAction.update', async () => {
    await db
      .update(articles)
      .set({ status: status.data, updatedAt: new Date() })
      .where(eq(articles.id, articleId.data));
  });

  revalidatePath(ARTICLES_PATH);
  revalidatePath('/admin/competitions');
  redirectWithNotice(redirectTo, 'success', '文章状态已更新');
}

export async function updateArticleContentAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, ARTICLES_PATH);
  await requireArticleManagementAdmin(redirectTo);

  const schema = createArticleSchema.extend({
    articleId: z.coerce.number().int().positive(),
    status: z.enum(['draft', 'published', 'archived']).default('published'),
  });

  const parsed = schema.safeParse({
    articleId: formData.get('articleId'),
    title: formData.get('title'),
    language: formData.get('language'),
    difficultyLevel: formData.get('difficultyLevel') || undefined,
    status: formData.get('status') || undefined,
    contentRaw: formData.get('contentRaw'),
  });

  if (!parsed.success) {
    redirectWithNotice(redirectTo, 'error', parsed.error.issues[0]?.message ?? '文章信息不完整');
  }

  const data = parsed.data;
  const { contentNormalized, charCount, wordCount } = computeArticleMetrics(data.contentRaw, data.language);

  await withDatabaseRetry('updateArticleContentAction.update', async () => {
    await db
      .update(articles)
      .set({
        title: data.title,
        language: data.language,
        contentRaw: data.contentRaw,
        contentNormalized,
        charCount,
        wordCount,
        difficultyLevel: data.difficultyLevel,
        status: data.status,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, data.articleId));
  });

  revalidatePath(ARTICLES_PATH);
  revalidatePath('/admin/competitions');
  redirectWithNotice(redirectTo, 'success', `文章「${data.title}」已更新`);
}
