'use server';

import { and, desc, eq, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { db } from '@/db/client';
import {
  articles,
  attempts,
  campaignArticles,
  campaignCurrentArticles,
  campaigns,
  classGroups,
  students,
} from '@/db/schema';
import { slugify } from '@/lib/format';
import { normalizeTypingText } from '@/modules/typing-engine';

function getRedirectTarget(formData: FormData, fallback: string) {
  const redirectTo = formData.get('redirectTo');
  return typeof redirectTo === 'string' && redirectTo.startsWith('/') ? redirectTo : fallback;
}

function redirectWithNotice(path: string, key: 'success' | 'error', message: string): never {
  const target = new URL(path, 'http://localhost');
  target.searchParams.set(key, message);
  redirect(`${target.pathname}${target.search}`);
}

const classGroupSchema = z.object({
  gradeYear: z.coerce.number().int().min(2000),
  department: z.string().trim().min(1),
  major: z.string().trim().min(1),
  name: z.string().trim().min(1),
  code: z.string().trim().min(1),
});

const studentSchema = z.object({
  studentNo: z.string().trim().min(1),
  name: z.string().trim().min(1),
  campusEmail: z
    .string()
    .trim()
    .email()
    .refine((value) => value.toLowerCase().endsWith('@ucass.edu.cn'), '校园邮箱必须以 @ucass.edu.cn 结尾'),
  classGroupId: z.coerce.number().int().positive().optional(),
  notes: z.string().trim().optional(),
});

const articleSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  title: z.string().trim().min(1),
  slug: z.string().trim().optional(),
  language: z.enum(['en', 'zh']).default('en'),
  contentRaw: z.string().trim().min(1),
  difficultyLevel: z.coerce.number().int().min(1).max(5).default(1),
  source: z.string().trim().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
});

const campaignSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1),
  academicYear: z.string().trim().min(1),
  term: z.string().trim().min(1),
  mode: z.enum(['practice', 'exam']),
  status: z.enum(['draft', 'scheduled', 'active', 'closed', 'archived']),
  durationSeconds: z.coerce.number().int().min(30).max(7200),
  articleStrategy: z.enum(['fixed', 'daily_random', 'shuffle_once']),
  allowRetry: z.coerce.boolean().optional().default(false),
  maxAttemptsPerStudent: z.coerce.number().int().min(1).max(999),
  rankingVisibility: z.enum(['public', 'class_only', 'hidden']),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  currentArticleId: z.coerce.number().int().positive().optional(),
});

const attemptStatusSchema = z.enum(['submitted', 'invalidated']);

export async function createClassGroupAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, '/admin/classes');
  const parsed = classGroupSchema.safeParse({
    gradeYear: formData.get('gradeYear'),
    department: formData.get('department'),
    major: formData.get('major'),
    name: formData.get('name'),
    code: formData.get('code'),
  });

  if (!parsed.success) {
    redirectWithNotice(redirectTo, 'error', parsed.error.issues[0]?.message ?? '班级信息不完整');
  }

  const data = parsed.data;

  await db.insert(classGroups).values(data).onConflictDoUpdate({
    target: classGroups.code,
    set: {
      gradeYear: data.gradeYear,
      department: data.department,
      major: data.major,
      name: data.name,
      updatedAt: new Date(),
    },
  });

  revalidatePath('/admin/classes');
  redirectWithNotice(redirectTo, 'success', '班级已保存');
}

export async function createStudentAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, '/admin/students');
  const parsed = studentSchema.safeParse({
    studentNo: formData.get('studentNo'),
    name: formData.get('name'),
    campusEmail: formData.get('campusEmail'),
    classGroupId: formData.get('classGroupId') || undefined,
    notes: formData.get('notes') || undefined,
  });

  if (!parsed.success) {
    redirectWithNotice(redirectTo, 'error', parsed.error.issues[0]?.message ?? '学生信息不完整');
  }

  const data = parsed.data;

  await db.insert(students).values({
    studentNo: data.studentNo,
    name: data.name,
    campusEmail: data.campusEmail.toLowerCase(),
    classGroupId: data.classGroupId ?? null,
    notes: data.notes ?? null,
    status: 'active',
  }).onConflictDoUpdate({
    target: students.studentNo,
    set: {
      name: data.name,
      campusEmail: data.campusEmail.toLowerCase(),
      classGroupId: data.classGroupId ?? null,
      notes: data.notes ?? null,
      updatedAt: new Date(),
    },
  });

  revalidatePath('/admin/students');
  redirectWithNotice(redirectTo, 'success', '学生已保存');
}

export async function importStudentsCsvAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, '/admin/students');
  const csvText = String(formData.get('csvText') ?? '').trim();

  if (!csvText) {
    redirectWithNotice(redirectTo, 'error', '请先粘贴 CSV 内容');
  }

  const classGroupRows = await db.select({
    id: classGroups.id,
    code: classGroups.code,
  }).from(classGroups);

  const classGroupMap = new Map(classGroupRows.map((row) => [row.code, row.id]));
  const lines = csvText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const header = lines[0]?.toLowerCase();
  const dataLines = header === 'student_no,name,class_code,campus_email' ? lines.slice(1) : lines;

  if (dataLines.length === 0) {
    redirectWithNotice(redirectTo, 'error', 'CSV 内容为空');
  }

  for (const line of dataLines) {
    const [studentNo = '', name = '', classCode = '', campusEmail = ''] = line.split(',').map((part) => part.trim());

    const parsed = studentSchema.safeParse({
      studentNo,
      name,
      campusEmail,
      classGroupId: classCode ? classGroupMap.get(classCode) : undefined,
      notes: undefined,
    });

    if (!parsed.success) {
      redirectWithNotice(redirectTo, 'error', `导入失败：${line}`);
    }

    const data = parsed.data;

    await db.insert(students).values({
      studentNo: data.studentNo,
      name: data.name,
      campusEmail: data.campusEmail.toLowerCase(),
      classGroupId: data.classGroupId ?? null,
      notes: null,
      status: 'active',
    }).onConflictDoUpdate({
      target: students.studentNo,
      set: {
        name: data.name,
        campusEmail: data.campusEmail.toLowerCase(),
        classGroupId: data.classGroupId ?? null,
        updatedAt: new Date(),
      },
    });
  }

  revalidatePath('/admin/students');
  redirectWithNotice(redirectTo, 'success', `已导入 ${dataLines.length} 条学生记录`);
}

export async function updateStudentStatusAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, '/admin/students');
  const studentId = z.coerce.number().int().positive().parse(formData.get('studentId'));
  const status = z.enum(['active', 'inactive']).parse(formData.get('status'));

  await db.update(students).set({
    status,
    updatedAt: new Date(),
  }).where(eq(students.id, studentId));

  revalidatePath('/admin/students');
  redirectWithNotice(redirectTo, 'success', '学生状态已更新');
}

export async function saveArticleAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, '/admin/articles');
  const parsed = articleSchema.safeParse({
    id: formData.get('id') || undefined,
    title: formData.get('title'),
    slug: formData.get('slug') || undefined,
    language: formData.get('language') || 'en',
    contentRaw: formData.get('contentRaw'),
    difficultyLevel: formData.get('difficultyLevel') || 1,
    source: formData.get('source') || undefined,
    status: formData.get('status') || 'draft',
  });

  if (!parsed.success) {
    redirectWithNotice(redirectTo, 'error', parsed.error.issues[0]?.message ?? '文章信息不完整');
  }

  const data = parsed.data;
  const contentNormalized = normalizeTypingText(data.contentRaw);
  const wordCount = contentNormalized.split(/\s+/).filter(Boolean).length;
  const values = {
    title: data.title,
    slug: data.slug ? slugify(data.slug) : slugify(data.title),
    language: data.language,
    contentRaw: data.contentRaw,
    contentNormalized,
    charCount: contentNormalized.length,
    wordCount,
    difficultyLevel: data.difficultyLevel,
    source: data.source ?? null,
    status: data.status,
  } as const;

  if (data.id) {
    await db.update(articles).set({
      ...values,
      updatedAt: new Date(),
    }).where(eq(articles.id, data.id));
  } else {
    await db.insert(articles).values(values);
  }

  revalidatePath('/admin/articles');
  redirectWithNotice(data.id ? `/admin/articles/${data.id}` : '/admin/articles', 'success', '文章已保存');
}

export async function saveCampaignAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, '/admin/campaigns');
  const parsed = campaignSchema.safeParse({
    id: formData.get('id') || undefined,
    name: formData.get('name'),
    academicYear: formData.get('academicYear'),
    term: formData.get('term'),
    mode: formData.get('mode'),
    status: formData.get('status'),
    durationSeconds: formData.get('durationSeconds'),
    articleStrategy: formData.get('articleStrategy'),
    allowRetry: formData.get('allowRetry') === 'on',
    maxAttemptsPerStudent: formData.get('maxAttemptsPerStudent'),
    rankingVisibility: formData.get('rankingVisibility'),
    startAt: formData.get('startAt') || undefined,
    endAt: formData.get('endAt') || undefined,
    currentArticleId: formData.get('currentArticleId') || undefined,
  });

  if (!parsed.success) {
    redirectWithNotice(redirectTo, 'error', parsed.error.issues[0]?.message ?? '场次信息不完整');
  }

  const data = parsed.data;
  const articleIds = formData
    .getAll('articleIds')
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  const values = {
    name: data.name,
    academicYear: data.academicYear,
    term: data.term,
    mode: data.mode,
    status: data.status,
    durationSeconds: data.durationSeconds,
    articleStrategy: data.articleStrategy,
    allowRetry: data.allowRetry,
    maxAttemptsPerStudent: data.maxAttemptsPerStudent,
    rankingVisibility: data.rankingVisibility,
    startAt: data.startAt ? new Date(data.startAt) : null,
    endAt: data.endAt ? new Date(data.endAt) : null,
  } as const;

  let savedCampaignId = data.id;

  if (savedCampaignId) {
    await db.update(campaigns).set({
      ...values,
      updatedAt: new Date(),
    }).where(eq(campaigns.id, savedCampaignId));
  } else {
    await db.insert(campaigns).values(values);
    const created = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.name, values.name),
        eq(campaigns.academicYear, values.academicYear),
        eq(campaigns.term, values.term),
      ),
      orderBy: [desc(campaigns.createdAt)],
    });
    savedCampaignId = created?.id;
  }

  if (!savedCampaignId) {
    redirectWithNotice(redirectTo, 'error', '场次保存失败');
  }

  if (values.status === 'active') {
    await db.update(campaigns).set({
      status: 'scheduled',
      updatedAt: new Date(),
    }).where(and(eq(campaigns.status, 'active'), ne(campaigns.id, savedCampaignId)));

    await db.update(campaigns).set({
      status: 'active',
      updatedAt: new Date(),
    }).where(eq(campaigns.id, savedCampaignId));
  }

  await db.delete(campaignArticles).where(eq(campaignArticles.campaignId, savedCampaignId));

  if (articleIds.length > 0) {
    await db.insert(campaignArticles).values(
      articleIds.map((articleId, index) => ({
        campaignId: savedCampaignId,
        articleId,
        sortOrder: index + 1,
        isActive: true,
      })),
    );
  }

  const currentArticleId = data.currentArticleId ?? articleIds[0];
  if (currentArticleId && articleIds.includes(currentArticleId)) {
    await db.insert(campaignCurrentArticles).values({
      campaignId: savedCampaignId,
      articleId: currentArticleId,
      reason: 'manual',
      resolvedDate: new Date().toISOString().slice(0, 10),
    });
  }

  revalidatePath('/admin');
  revalidatePath('/admin/campaigns');
  revalidatePath(`/admin/campaigns/${savedCampaignId}`);
  redirectWithNotice(`/admin/campaigns/${savedCampaignId}`, 'success', '场次已保存');
}

export async function setCurrentArticleAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, '/admin/campaigns');
  const campaignId = z.coerce.number().int().positive().parse(formData.get('campaignId'));
  const articleId = z.coerce.number().int().positive().parse(formData.get('articleId'));

  await db.insert(campaignCurrentArticles).values({
    campaignId,
    articleId,
    reason: 'manual',
    resolvedDate: new Date().toISOString().slice(0, 10),
  });

  revalidatePath('/admin/campaigns');
  revalidatePath(`/admin/campaigns/${campaignId}`);
  redirectWithNotice(redirectTo, 'success', '当前文章已切换');
}

export async function setAttemptStatusAction(formData: FormData) {
  const redirectTo = getRedirectTarget(formData, '/admin/attempts');
  const attemptId = z.coerce.number().int().positive().parse(formData.get('attemptId'));
  const status = attemptStatusSchema.parse(formData.get('status'));

  await db.update(attempts).set({
    status,
    updatedAt: new Date(),
  }).where(eq(attempts.id, attemptId));

  revalidatePath('/admin/attempts');
  redirectWithNotice(redirectTo, 'success', '成绩状态已更新');
}
