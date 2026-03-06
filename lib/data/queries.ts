import {
  and,
  asc,
  count,
  desc,
  eq,
  like,
  or,
  sql,
} from 'drizzle-orm';

import { db } from '@/db/client';
import {
  adminUsers,
  articles,
  attempts,
  campaignArticles,
  campaignCurrentArticles,
  campaigns,
  classGroups,
  students,
} from '@/db/schema';

type StudentIdentityInput = {
  studentNo: string;
  name: string;
  campusEmail: string;
};

export type DashboardOverview = {
  totalStudents: number;
  totalArticles: number;
  totalAttempts: number;
  activeCampaign: Awaited<ReturnType<typeof getActiveCampaign>>;
  recentAttempts: Awaited<ReturnType<typeof getRecentAttempts>>;
};

export type LeaderboardEntry = {
  rank: number;
  studentId: number;
  studentNo: string;
  name: string;
  campusEmail: string;
  className: string | null;
  classCode: string | null;
  attemptId: number;
  scoreKpm: number;
  accuracy: number;
  submittedAt: Date | null;
  attemptNo: number;
};

function normalizedEmail(email: string) {
  return email.trim().toLowerCase();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function deterministicIndex(total: number, seed: string) {
  const value = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return value % total;
}

export async function getStudentByIdentity(input: StudentIdentityInput) {
  return db.query.students.findFirst({
    where: and(
      eq(students.studentNo, input.studentNo.trim()),
      eq(students.name, input.name.trim()),
      sql<boolean>`lower(${students.campusEmail}) = ${normalizedEmail(input.campusEmail)}`,
      eq(students.status, 'active'),
    ),
  });
}

export async function getAdminByUsername(username: string) {
  return db.query.adminUsers.findFirst({
    where: and(eq(adminUsers.username, username.trim()), eq(adminUsers.status, 'active')),
  });
}

export async function getClassGroupsList() {
  const rows = await db
    .select({
      id: classGroups.id,
      code: classGroups.code,
      name: classGroups.name,
      gradeYear: classGroups.gradeYear,
      department: classGroups.department,
      major: classGroups.major,
      studentCount: count(students.id),
      createdAt: classGroups.createdAt,
      updatedAt: classGroups.updatedAt,
    })
    .from(classGroups)
    .leftJoin(students, eq(students.classGroupId, classGroups.id))
    .groupBy(classGroups.id)
    .orderBy(desc(classGroups.gradeYear), asc(classGroups.code));

  return rows;
}

export async function getStudentsList(search?: string) {
  const keyword = search?.trim();
  const filter = keyword
    ? or(
        like(students.studentNo, `%${keyword}%`),
        like(students.name, `%${keyword}%`),
        like(students.campusEmail, `%${keyword}%`),
        like(classGroups.name, `%${keyword}%`),
        like(classGroups.code, `%${keyword}%`),
      )
    : undefined;

  return db
    .select({
      id: students.id,
      studentNo: students.studentNo,
      name: students.name,
      campusEmail: students.campusEmail,
      status: students.status,
      notes: students.notes,
      createdAt: students.createdAt,
      updatedAt: students.updatedAt,
      classGroupId: classGroups.id,
      className: classGroups.name,
      classCode: classGroups.code,
    })
    .from(students)
    .leftJoin(classGroups, eq(classGroups.id, students.classGroupId))
    .where(filter)
    .orderBy(desc(students.createdAt), asc(students.studentNo));
}

export async function getArticlesList() {
  return db.query.articles.findMany({
    orderBy: [desc(articles.updatedAt), asc(articles.title)],
  });
}

export async function getArticleById(id: number) {
  return db.query.articles.findFirst({
    where: eq(articles.id, id),
  });
}

export async function getCampaignsList() {
  return db.query.campaigns.findMany({
    orderBy: [
      desc(campaigns.status),
      desc(campaigns.updatedAt),
      desc(campaigns.createdAt),
    ],
  });
}

export async function getCampaignById(id: number) {
  return db.query.campaigns.findFirst({
    where: eq(campaigns.id, id),
  });
}

export async function getCampaignArticleAssignments(campaignId: number) {
  return db
    .select({
      campaignId: campaignArticles.campaignId,
      articleId: campaignArticles.articleId,
      sortOrder: campaignArticles.sortOrder,
      isActive: campaignArticles.isActive,
      title: articles.title,
      slug: articles.slug,
      language: articles.language,
      status: articles.status,
      contentRaw: articles.contentRaw,
    })
    .from(campaignArticles)
    .innerJoin(articles, eq(articles.id, campaignArticles.articleId))
    .where(eq(campaignArticles.campaignId, campaignId))
    .orderBy(asc(campaignArticles.sortOrder), asc(articles.title));
}

export async function getLatestCampaignCurrentArticle(campaignId: number) {
  return db.query.campaignCurrentArticles.findFirst({
    where: eq(campaignCurrentArticles.campaignId, campaignId),
    orderBy: [desc(campaignCurrentArticles.createdAt)],
  });
}

export async function getActiveCampaign() {
  return db.query.campaigns.findFirst({
    where: eq(campaigns.status, 'active'),
    orderBy: [desc(campaigns.updatedAt), desc(campaigns.createdAt)],
  });
}

export async function resolveCurrentArticleForCampaign(campaignId: number) {
  const campaign = await getCampaignById(campaignId);

  if (!campaign) {
    return null;
  }

  const assignments = (await getCampaignArticleAssignments(campaignId)).filter(
    (assignment) => assignment.isActive,
  );

  if (assignments.length === 0) {
    return null;
  }

  const latestCurrent = await getLatestCampaignCurrentArticle(campaignId);
  const manualCurrentIsValid =
    latestCurrent?.reason === 'manual' &&
    assignments.some((assignment) => assignment.articleId === latestCurrent.articleId);

  if (manualCurrentIsValid) {
    return assignments.find((assignment) => assignment.articleId === latestCurrent?.articleId) ?? null;
  }

  const fallbackArticle = assignments[0];

  if (campaign.articleStrategy === 'fixed') {
    if (!latestCurrent || latestCurrent.articleId !== fallbackArticle.articleId) {
      await db.insert(campaignCurrentArticles).values({
        campaignId,
        articleId: fallbackArticle.articleId,
        reason: 'manual',
        resolvedDate: todayKey(),
      });
    }

    return fallbackArticle;
  }

  if (campaign.articleStrategy === 'shuffle_once') {
    if (latestCurrent) {
      const matched = assignments.find((assignment) => assignment.articleId === latestCurrent.articleId);
      if (matched) {
        return matched;
      }
    }

    const selected = assignments[Math.floor(Math.random() * assignments.length)] ?? fallbackArticle;
    await db.insert(campaignCurrentArticles).values({
      campaignId,
      articleId: selected.articleId,
      reason: 'shuffle_once',
      resolvedDate: todayKey(),
    });
    return selected;
  }

  const today = todayKey();
  const todayCurrent = await db.query.campaignCurrentArticles.findFirst({
    where: and(
      eq(campaignCurrentArticles.campaignId, campaignId),
      eq(campaignCurrentArticles.reason, 'daily_random'),
      eq(campaignCurrentArticles.resolvedDate, today),
    ),
    orderBy: [desc(campaignCurrentArticles.createdAt)],
  });

  if (todayCurrent) {
    const matched = assignments.find((assignment) => assignment.articleId === todayCurrent.articleId);
    if (matched) {
      return matched;
    }
  }

  const selected = assignments[deterministicIndex(assignments.length, today)] ?? fallbackArticle;

  await db.insert(campaignCurrentArticles).values({
    campaignId,
    articleId: selected.articleId,
    reason: 'daily_random',
    resolvedDate: today,
  });

  return selected;
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  const [studentCount, articleCount, attemptCount, activeCampaign, recentAttempts] = await Promise.all([
    db.select({ count: count() }).from(students).get(),
    db.select({ count: count() }).from(articles).get(),
    db.select({ count: count() }).from(attempts).get(),
    getActiveCampaign(),
    getRecentAttempts(),
  ]);

  return {
    totalStudents: studentCount?.count ?? 0,
    totalArticles: articleCount?.count ?? 0,
    totalAttempts: attemptCount?.count ?? 0,
    activeCampaign,
    recentAttempts,
  };
}

export async function getRecentAttempts(limit = 8) {
  return db
    .select({
      attemptId: attempts.id,
      studentNo: attempts.studentNoSnapshot,
      studentName: attempts.studentNameSnapshot,
      articleTitle: attempts.articleTitleSnapshot,
      scoreKpm: attempts.scoreKpm,
      accuracy: attempts.accuracy,
      status: attempts.status,
      submittedAt: attempts.submittedAt,
      campaignName: campaigns.name,
    })
    .from(attempts)
    .leftJoin(campaigns, eq(campaigns.id, attempts.campaignId))
    .orderBy(desc(attempts.createdAt))
    .limit(limit);
}

export async function ensureAttemptForStudent(studentId: number) {
  const activeCampaign = await getActiveCampaign();

  if (!activeCampaign) {
    return { state: 'no-campaign' as const };
  }

  const [student, currentArticle] = await Promise.all([
    db.query.students.findFirst({ where: eq(students.id, studentId) }),
    resolveCurrentArticleForCampaign(activeCampaign.id),
  ]);

  if (!student) {
    return { state: 'missing-student' as const };
  }

  if (!currentArticle) {
    return { state: 'no-article' as const, campaign: activeCampaign };
  }

  const latestAttempt = await db.query.attempts.findFirst({
    where: and(eq(attempts.campaignId, activeCampaign.id), eq(attempts.studentId, studentId)),
    orderBy: [desc(attempts.attemptNo), desc(attempts.createdAt)],
  });

  if (latestAttempt?.status === 'started') {
    return {
      state: 'ready' as const,
      campaign: activeCampaign,
      article: currentArticle,
      attempt: latestAttempt,
    };
  }

  const totalAttempts = await db
    .select({ count: count() })
    .from(attempts)
    .where(and(eq(attempts.campaignId, activeCampaign.id), eq(attempts.studentId, studentId)))
    .get();

  const usedAttempts = totalAttempts?.count ?? 0;
  const maxAttempts = activeCampaign.maxAttemptsPerStudent;
  const retriesAllowed = activeCampaign.allowRetry;

  if ((retriesAllowed && usedAttempts >= maxAttempts) || (!retriesAllowed && usedAttempts >= 1)) {
    return {
      state: 'locked' as const,
      campaign: activeCampaign,
      article: currentArticle,
      latestAttempt,
    };
  }

  const attemptNo = usedAttempts + 1;

  await db.insert(attempts).values({
    campaignId: activeCampaign.id,
    studentId: student.id,
    classGroupId: student.classGroupId,
    articleId: currentArticle.articleId,
    attemptNo,
    status: 'started',
    studentNoSnapshot: student.studentNo,
    studentNameSnapshot: student.name,
    campusEmailSnapshot: student.campusEmail,
    articleTitleSnapshot: currentArticle.title,
    durationSecondsAllocated: activeCampaign.durationSeconds,
    typedTextRaw: '',
    typedTextNormalized: '',
    suspicionFlags: [],
    clientMeta: {},
  });

  const attempt = await db.query.attempts.findFirst({
    where: and(
      eq(attempts.campaignId, activeCampaign.id),
      eq(attempts.studentId, student.id),
      eq(attempts.attemptNo, attemptNo),
    ),
  });

  return {
    state: 'ready' as const,
    campaign: activeCampaign,
    article: currentArticle,
    attempt,
  };
}

export async function getAttemptById(attemptId: number) {
  return db.query.attempts.findFirst({
    where: eq(attempts.id, attemptId),
  });
}

export async function getAttemptDetail(attemptId: number) {
  return db
    .select({
      attemptId: attempts.id,
      campaignId: attempts.campaignId,
      campaignName: campaigns.name,
      articleId: attempts.articleId,
      articleTitle: attempts.articleTitleSnapshot,
      studentId: attempts.studentId,
      classGroupId: attempts.classGroupId,
      className: classGroups.name,
      classCode: classGroups.code,
      studentNo: attempts.studentNoSnapshot,
      studentName: attempts.studentNameSnapshot,
      campusEmail: attempts.campusEmailSnapshot,
      status: attempts.status,
      startedAt: attempts.startedAt,
      submittedAt: attempts.submittedAt,
      durationSecondsAllocated: attempts.durationSecondsAllocated,
      durationSecondsUsed: attempts.durationSecondsUsed,
      typedTextRaw: attempts.typedTextRaw,
      scoreKpm: attempts.scoreKpm,
      accuracy: attempts.accuracy,
      charCountTyped: attempts.charCountTyped,
      charCountCorrect: attempts.charCountCorrect,
      charCountError: attempts.charCountError,
      backspaceCount: attempts.backspaceCount,
      pasteCount: attempts.pasteCount,
      suspicionFlags: attempts.suspicionFlags,
      scoreVersion: attempts.scoreVersion,
      articleContent: articles.contentRaw,
    })
    .from(attempts)
    .leftJoin(campaigns, eq(campaigns.id, attempts.campaignId))
    .leftJoin(classGroups, eq(classGroups.id, attempts.classGroupId))
    .leftJoin(articles, eq(articles.id, attempts.articleId))
    .where(eq(attempts.id, attemptId))
    .get();
}

export async function getLeaderboard(campaignId: number): Promise<LeaderboardEntry[]> {
  const rows = await db
    .select({
      attemptId: attempts.id,
      studentId: attempts.studentId,
      studentNo: attempts.studentNoSnapshot,
      studentName: attempts.studentNameSnapshot,
      campusEmail: attempts.campusEmailSnapshot,
      className: classGroups.name,
      classCode: classGroups.code,
      scoreKpm: attempts.scoreKpm,
      accuracy: attempts.accuracy,
      submittedAt: attempts.submittedAt,
      attemptNo: attempts.attemptNo,
      status: attempts.status,
    })
    .from(attempts)
    .leftJoin(classGroups, eq(classGroups.id, attempts.classGroupId))
    .where(and(eq(attempts.campaignId, campaignId), eq(attempts.status, 'submitted')))
    .orderBy(desc(attempts.scoreKpm), desc(attempts.accuracy), asc(attempts.submittedAt));

  const bestByStudent = new Map<number, LeaderboardEntry>();

  for (const row of rows) {
    const existing = bestByStudent.get(row.studentId);
    const candidate: LeaderboardEntry = {
      rank: 0,
      studentId: row.studentId,
      studentNo: row.studentNo,
      name: row.studentName,
      campusEmail: row.campusEmail,
      className: row.className,
      classCode: row.classCode,
      attemptId: row.attemptId,
      scoreKpm: row.scoreKpm,
      accuracy: row.accuracy,
      submittedAt: row.submittedAt,
      attemptNo: row.attemptNo,
    };

    if (!existing) {
      bestByStudent.set(row.studentId, candidate);
      continue;
    }

    const shouldReplace =
      candidate.scoreKpm > existing.scoreKpm ||
      (candidate.scoreKpm === existing.scoreKpm && candidate.accuracy > existing.accuracy) ||
      (candidate.scoreKpm === existing.scoreKpm &&
        candidate.accuracy === existing.accuracy &&
        (candidate.submittedAt?.getTime() ?? 0) < (existing.submittedAt?.getTime() ?? 0));

    if (shouldReplace) {
      bestByStudent.set(row.studentId, candidate);
    }
  }

  return Array.from(bestByStudent.values())
    .sort((left, right) => {
      if (right.scoreKpm !== left.scoreKpm) {
        return right.scoreKpm - left.scoreKpm;
      }
      if (right.accuracy !== left.accuracy) {
        return right.accuracy - left.accuracy;
      }
      return (left.submittedAt?.getTime() ?? 0) - (right.submittedAt?.getTime() ?? 0);
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export async function getAttemptsList(filters?: {
  campaignId?: number;
  status?: string;
  query?: string;
}) {
  const conditions = [];

  if (filters?.campaignId) {
    conditions.push(eq(attempts.campaignId, filters.campaignId));
  }

  if (filters?.status) {
    conditions.push(eq(attempts.status, filters.status as typeof attempts.$inferSelect.status));
  }

  if (filters?.query?.trim()) {
    const keyword = filters.query.trim();
    conditions.push(
      or(
        like(attempts.studentNoSnapshot, `%${keyword}%`),
        like(attempts.studentNameSnapshot, `%${keyword}%`),
        like(attempts.campusEmailSnapshot, `%${keyword}%`),
        like(campaigns.name, `%${keyword}%`),
        like(attempts.articleTitleSnapshot, `%${keyword}%`),
      )!,
    );
  }

  return db
    .select({
      id: attempts.id,
      campaignId: attempts.campaignId,
      campaignName: campaigns.name,
      studentNo: attempts.studentNoSnapshot,
      studentName: attempts.studentNameSnapshot,
      campusEmail: attempts.campusEmailSnapshot,
      articleTitle: attempts.articleTitleSnapshot,
      status: attempts.status,
      scoreKpm: attempts.scoreKpm,
      accuracy: attempts.accuracy,
      submittedAt: attempts.submittedAt,
      attemptNo: attempts.attemptNo,
      suspicionFlags: attempts.suspicionFlags,
    })
    .from(attempts)
    .leftJoin(campaigns, eq(campaigns.id, attempts.campaignId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(attempts.createdAt));
}

export async function getExportRows(campaignId?: number) {
  const conditions = campaignId ? [eq(attempts.campaignId, campaignId)] : [];

  return db
    .select({
      campaignName: campaigns.name,
      studentNo: attempts.studentNoSnapshot,
      studentName: attempts.studentNameSnapshot,
      campusEmail: attempts.campusEmailSnapshot,
      className: classGroups.name,
      classCode: classGroups.code,
      articleTitle: attempts.articleTitleSnapshot,
      scoreKpm: attempts.scoreKpm,
      accuracy: attempts.accuracy,
      status: attempts.status,
      startedAt: attempts.startedAt,
      submittedAt: attempts.submittedAt,
      durationSecondsUsed: attempts.durationSecondsUsed,
      backspaceCount: attempts.backspaceCount,
      pasteCount: attempts.pasteCount,
      suspicionFlags: attempts.suspicionFlags,
      ipAddress: attempts.ipAddress,
    })
    .from(attempts)
    .leftJoin(campaigns, eq(campaigns.id, attempts.campaignId))
    .leftJoin(classGroups, eq(classGroups.id, attempts.classGroupId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(attempts.createdAt));
}
