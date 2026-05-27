'use server';

import { count, eq, like, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { db, withDatabaseRetry } from '@/db/client';
import { articles, attempts, competitions } from '@/db/schema';
import { canManageCompetitions } from '@/lib/auth/admin-authorization';
import { getCurrentAdmin } from '@/lib/auth/session';
import { slugify } from '@/lib/format';
import { getRedirectTarget, parseOptionalDateTime, redirectWithNotice } from '@/features/admin/action-helpers';

const COMPETITIONS_PATH = '/admin/competitions';

async function requireCompetitionManagementAdmin(redirectTo: string) {
  const currentAdmin = await getCurrentAdmin();

  if (!currentAdmin) {
    redirect('/admin/login');
  }

  if (!canManageCompetitions(currentAdmin.admin.role)) {
    redirectWithNotice(redirectTo, 'error', '当前账号没有管理竞赛的权限。');
  }

  return currentAdmin;
}

const competitionFieldsSchema = z.object({
  title: z.string().trim().min(1, '竞赛名称不能为空').max(160, '竞赛名称过长'),
  description: z.string().trim().max(2_000).optional(),
  articleId: z.coerce.number().int().positive('请选择竞赛文章'),
  durationSeconds: z.coerce.number().int().min(30, '时长至少 30 秒').max(3_600, '时长最多 3600 秒'),
  maxAttemptsPerStudent: z.coerce.number().int().min(1, '至少允许 1 次').max(50, '最多允许 50 次'),
});

async function ensureUniqueCompetitionSlug(title: string, ignoreId?: number) {
  const base = slugify(title) || 'competition';

  const existing = await withDatabaseRetry('ensureUniqueCompetitionSlug', async () => (
    db
      .select({ id: competitions.id, slug: competitions.slug })
      .from(competitions)
      .where(or(eq(competitions.slug, base), like(competitions.slug, `${base}-%`)))
  ));

  const taken = new Set(existing.filter((row) => row.id !== ignoreId).map((row) => row.slug));
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

async function resolveArticleForCompetition(articleId: number, redirectTo: string) {
  const article = await withDatabaseRetry('resolveArticleForCompetition', async () => (
    db
      .select({ id: articles.id, title: articles.title, status: articles.status })
      .from(articles)
      .where(eq(articles.id, articleId))
      .get()
  ));

  if (!article) {
    redirectWithNotice(redirectTo, 'error', '所选文章不存在');
  }

  if (article.status === 'archived') {
    redirectWithNotice(redirectTo, 'error', '所选文章已归档，无法用于竞赛');
  }

  return article;
}

function resolveWindow(formData: FormData, redirectTo: string) {
  const start = parseOptionalDateTime(formData.get('startAt'));
  const end = parseOptionalDateTime(formData.get('endAt'));

  if (!start.ok || !end.ok) {
    redirectWithNotice(redirectTo, 'error', '开始或结束时间格式不正确');
  }

  if (start.value && end.value && end.value.getTime() <= start.value.getTime()) {
    redirectWithNotice(redirectTo, 'error', '结束时间必须晚于开始时间');
  }

  return { startAt: start.value, endAt: end.value };
}

export async function createCompetitionAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, COMPETITIONS_PATH);
  const admin = await requireCompetitionManagementAdmin(redirectTo);

  const parsed = competitionFieldsSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    articleId: formData.get('articleId'),
    durationSeconds: formData.get('durationSeconds'),
    maxAttemptsPerStudent: formData.get('maxAttemptsPerStudent'),
  });

  if (!parsed.success) {
    redirectWithNotice(redirectTo, 'error', parsed.error.issues[0]?.message ?? '竞赛信息不完整');
  }

  const data = parsed.data;
  const article = await resolveArticleForCompetition(data.articleId, redirectTo);
  const { startAt, endAt } = resolveWindow(formData, redirectTo);
  const slug = await ensureUniqueCompetitionSlug(data.title);

  await withDatabaseRetry('createCompetitionAction.insert', async () => {
    await db.insert(competitions).values({
      title: data.title,
      slug,
      description: data.description ?? null,
      articleId: article.id,
      articleTitleSnapshot: article.title,
      status: 'draft',
      durationSeconds: data.durationSeconds,
      maxAttemptsPerStudent: data.maxAttemptsPerStudent,
      startAt,
      endAt,
      createdByAdminId: admin.admin.id,
    });
  });

  revalidatePath(COMPETITIONS_PATH);
  redirectWithNotice(redirectTo, 'success', `竞赛「${data.title}」已创建（草稿），开启后学生即可参加`);
}

export async function updateCompetitionAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, COMPETITIONS_PATH);
  await requireCompetitionManagementAdmin(redirectTo);

  const competitionId = z.coerce.number().int().positive().safeParse(formData.get('competitionId'));
  if (!competitionId.success) {
    redirectWithNotice(redirectTo, 'error', '竞赛不存在');
  }

  const existing = await withDatabaseRetry('updateCompetitionAction.find', async () => (
    db.query.competitions.findFirst({ where: eq(competitions.id, competitionId.data) })
  ));

  if (!existing) {
    redirectWithNotice(redirectTo, 'error', '竞赛不存在');
  }

  if (existing.status === 'archived') {
    redirectWithNotice(redirectTo, 'error', '已归档的竞赛不可再编辑');
  }

  const parsed = competitionFieldsSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    articleId: formData.get('articleId'),
    durationSeconds: formData.get('durationSeconds'),
    maxAttemptsPerStudent: formData.get('maxAttemptsPerStudent'),
  });

  if (!parsed.success) {
    redirectWithNotice(redirectTo, 'error', parsed.error.issues[0]?.message ?? '竞赛信息不完整');
  }

  const data = parsed.data;
  const article = await resolveArticleForCompetition(data.articleId, redirectTo);
  const { startAt, endAt } = resolveWindow(formData, redirectTo);
  const slug = await ensureUniqueCompetitionSlug(data.title, existing.id);

  await withDatabaseRetry('updateCompetitionAction.update', async () => {
    await db
      .update(competitions)
      .set({
        title: data.title,
        slug,
        description: data.description ?? null,
        articleId: article.id,
        articleTitleSnapshot: article.title,
        durationSeconds: data.durationSeconds,
        maxAttemptsPerStudent: data.maxAttemptsPerStudent,
        startAt,
        endAt,
        updatedAt: new Date(),
      })
      .where(eq(competitions.id, existing.id));
  });

  revalidatePath(COMPETITIONS_PATH);
  redirectWithNotice(redirectTo, 'success', `竞赛「${data.title}」已更新`);
}

const statusActionMap = {
  publish: { status: 'published' as const, message: '竞赛已开启，学生可以开始参加' },
  close: { status: 'closed' as const, message: '竞赛已关闭，成绩榜已冻结' },
  archive: { status: 'archived' as const, message: '竞赛已归档' },
  draft: { status: 'draft' as const, message: '竞赛已下线为草稿' },
};

export async function updateCompetitionStatusAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, COMPETITIONS_PATH);
  await requireCompetitionManagementAdmin(redirectTo);

  const competitionId = z.coerce.number().int().positive().safeParse(formData.get('competitionId'));
  const action = z.enum(['publish', 'close', 'archive', 'draft']).safeParse(formData.get('action'));

  if (!competitionId.success || !action.success) {
    redirectWithNotice(redirectTo, 'error', '请求参数不合法');
  }

  const target = statusActionMap[action.data];

  // Publishing requires a usable article: guard against publishing a competition
  // whose article was archived after creation.
  if (action.data === 'publish') {
    const competition = await withDatabaseRetry('updateCompetitionStatusAction.find', async () => (
      db
        .select({ articleStatus: articles.status })
        .from(competitions)
        .leftJoin(articles, eq(articles.id, competitions.articleId))
        .where(eq(competitions.id, competitionId.data))
        .get()
    ));

    if (!competition) {
      redirectWithNotice(redirectTo, 'error', '竞赛不存在');
    }

    if (competition.articleStatus === 'archived' || competition.articleStatus === null) {
      redirectWithNotice(redirectTo, 'error', '竞赛文章不可用，请先恢复或更换文章后再开启');
    }
  }

  await withDatabaseRetry('updateCompetitionStatusAction.update', async () => {
    await db
      .update(competitions)
      .set({ status: target.status, updatedAt: new Date() })
      .where(eq(competitions.id, competitionId.data));
  });

  revalidatePath(COMPETITIONS_PATH);
  redirectWithNotice(redirectTo, 'success', target.message);
}

export async function deleteCompetitionAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, COMPETITIONS_PATH);
  await requireCompetitionManagementAdmin(redirectTo);

  const competitionId = z.coerce.number().int().positive().safeParse(formData.get('competitionId'));
  if (!competitionId.success) {
    redirectWithNotice(redirectTo, 'error', '竞赛不存在');
  }

  const attemptCountRow = await withDatabaseRetry('deleteCompetitionAction.countAttempts', async () => (
    db
      .select({ total: count() })
      .from(attempts)
      .where(eq(attempts.competitionId, competitionId.data))
      .get()
  ));

  if ((attemptCountRow?.total ?? 0) > 0) {
    redirectWithNotice(redirectTo, 'error', '该竞赛已有参赛记录，无法删除，请改用「归档」');
  }

  await withDatabaseRetry('deleteCompetitionAction.delete', async () => {
    await db.delete(competitions).where(eq(competitions.id, competitionId.data));
  });

  revalidatePath(COMPETITIONS_PATH);
  redirectWithNotice(redirectTo, 'success', '竞赛已删除');
}
