import { and, asc, count, desc, eq, inArray, like, or, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { adminUsers, articles, attempts, students } from '@/db/schema';
import { MAX_ATTEMPTS_PER_STUDENT, TEST_DURATION_SECONDS } from '@/lib/env';

type StudentIdentityInput = {
  studentNo: string;
  name: string;
  campusEmail: string;
};

type RotatingArticle = {
  articleId: number;
  title: string;
  slug: string;
  language: 'en' | 'zh';
  status: 'draft' | 'published' | 'archived';
  contentRaw: string;
  source: string | null;
};

export type LeaderboardEntry = {
  rank: number;
  studentId: number;
  studentNo: string;
  name: string;
  campusEmail: string;
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

async function getRotatingArticlePool(): Promise<RotatingArticle[]> {
  const publishedArticles = await db
    .select({
      articleId: articles.id,
      title: articles.title,
      slug: articles.slug,
      language: articles.language,
      status: articles.status,
      contentRaw: articles.contentRaw,
      source: articles.source,
    })
    .from(articles)
    .where(eq(articles.status, 'published'))
    .orderBy(asc(articles.slug));

  const withoutDevSeed = publishedArticles.filter((article) => article.source !== 'seed:dev');
  return withoutDevSeed.length > 0 ? withoutDevSeed : publishedArticles;
}

export async function getCurrentRotatingArticle() {
  const pool = await getRotatingArticlePool();

  if (pool.length === 0) {
    return null;
  }

  return pool[deterministicIndex(pool.length, todayKey())] ?? pool[0];
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

export type AdminStudentSummary = {
  id: number;
  studentNo: string;
  name: string;
  campusEmail: string;
  status: 'active' | 'inactive';
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  bestSubmittedScoreKpm: number | null;
  bestSubmittedAccuracy: number | null;
  submittedAttemptCount: number;
  totalAttemptCount: number;
};

export type AdminStudentsPage = {
  items: AdminStudentSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AdminStudentAttemptSummary = {
  id: number;
  attemptNo: number;
  articleTitle: string;
  status: 'started' | 'submitted' | 'expired' | 'cancelled' | 'invalidated';
  scoreKpm: number;
  accuracy: number;
  startedAt: Date;
  submittedAt: Date | null;
  durationSecondsAllocated: number;
  durationSecondsUsed: number | null;
  suspicionFlags: string[];
};

export const ADMIN_STUDENTS_PAGE_SIZE = 100;

export async function getAdminStudentsPage({
  search,
  page = 1,
  pageSize = ADMIN_STUDENTS_PAGE_SIZE,
}: {
  search?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<AdminStudentsPage> {
  const keyword = search?.trim();
  const filter = keyword
    ? or(
        like(students.studentNo, `%${keyword}%`),
        like(students.name, `%${keyword}%`),
        like(students.campusEmail, `%${keyword}%`),
      )
    : undefined;

  const totalRow = await db
    .select({ count: count() })
    .from(students)
    .where(filter)
    .get();

  const total = totalRow?.count ?? 0;
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const resolvedPage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const offset = (resolvedPage - 1) * safePageSize;

  const studentRows = await db
    .select({
      id: students.id,
      studentNo: students.studentNo,
      name: students.name,
      campusEmail: students.campusEmail,
      status: students.status,
      notes: students.notes,
      createdAt: students.createdAt,
      updatedAt: students.updatedAt,
    })
    .from(students)
    .where(filter)
    .orderBy(desc(students.createdAt), asc(students.studentNo))
    .limit(safePageSize)
    .offset(offset);

  if (studentRows.length === 0) {
    return {
      items: [],
      total,
      page: resolvedPage,
      pageSize: safePageSize,
      totalPages,
    };
  }

  const attemptRows = await db
    .select({
      studentId: attempts.studentId,
      status: attempts.status,
      scoreKpm: attempts.scoreKpm,
      accuracy: attempts.accuracy,
      submittedAt: attempts.submittedAt,
    })
    .from(attempts)
    .where(inArray(attempts.studentId, studentRows.map((student) => student.id)))
    .orderBy(desc(attempts.createdAt), desc(attempts.attemptNo));

  const statsByStudent = new Map<number, {
    bestSubmittedScoreKpm: number | null;
    bestSubmittedAccuracy: number | null;
    bestSubmittedAt: number | null;
    submittedAttemptCount: number;
    totalAttemptCount: number;
  }>();

  for (const attempt of attemptRows) {
    const current = statsByStudent.get(attempt.studentId) ?? {
      bestSubmittedScoreKpm: null,
      bestSubmittedAccuracy: null,
      bestSubmittedAt: null,
      submittedAttemptCount: 0,
      totalAttemptCount: 0,
    };

    current.totalAttemptCount += 1;

    if (attempt.status === 'submitted') {
      current.submittedAttemptCount += 1;
      const submittedAtMs = attempt.submittedAt?.getTime() ?? 0;
      const shouldReplace =
        current.bestSubmittedScoreKpm === null
        || attempt.scoreKpm > current.bestSubmittedScoreKpm
        || (attempt.scoreKpm === current.bestSubmittedScoreKpm
          && (attempt.accuracy > (current.bestSubmittedAccuracy ?? 0)
            || (
              attempt.accuracy === (current.bestSubmittedAccuracy ?? 0)
              && submittedAtMs < (current.bestSubmittedAt ?? Number.POSITIVE_INFINITY)
            )));

      if (shouldReplace) {
        current.bestSubmittedScoreKpm = attempt.scoreKpm;
        current.bestSubmittedAccuracy = attempt.accuracy;
        current.bestSubmittedAt = submittedAtMs;
      }
    }

    statsByStudent.set(attempt.studentId, current);
  }

  return {
    items: studentRows.map((student) => {
      const stats = statsByStudent.get(student.id);

      return {
        ...student,
        bestSubmittedScoreKpm: stats?.bestSubmittedScoreKpm ?? null,
        bestSubmittedAccuracy: stats?.bestSubmittedAccuracy ?? null,
        submittedAttemptCount: stats?.submittedAttemptCount ?? 0,
        totalAttemptCount: stats?.totalAttemptCount ?? 0,
      } satisfies AdminStudentSummary;
    }),
    total,
    page: resolvedPage,
    pageSize: safePageSize,
    totalPages,
  };
}

export async function getAdminStudentAttemptSummaries(studentId: number): Promise<AdminStudentAttemptSummary[]> {
  return db
    .select({
      id: attempts.id,
      attemptNo: attempts.attemptNo,
      articleTitle: attempts.articleTitleSnapshot,
      status: attempts.status,
      scoreKpm: attempts.scoreKpm,
      accuracy: attempts.accuracy,
      startedAt: attempts.startedAt,
      submittedAt: attempts.submittedAt,
      durationSecondsAllocated: attempts.durationSecondsAllocated,
      durationSecondsUsed: attempts.durationSecondsUsed,
      suspicionFlags: attempts.suspicionFlags,
    })
    .from(attempts)
    .where(eq(attempts.studentId, studentId))
    .orderBy(desc(attempts.attemptNo), desc(attempts.createdAt));
}

export async function ensureAttemptForStudent(studentId: number) {
  const [student, currentArticle] = await Promise.all([
    db.query.students.findFirst({ where: eq(students.id, studentId) }),
    getCurrentRotatingArticle(),
  ]);

  if (!student) {
    return { state: 'missing-student' as const };
  }

  if (!currentArticle) {
    return { state: 'no-article' as const };
  }

  const latestAttempt = await db.query.attempts.findFirst({
    where: eq(attempts.studentId, studentId),
    orderBy: [desc(attempts.attemptNo), desc(attempts.createdAt)],
  });

  if (latestAttempt?.status === 'started') {
    return {
      state: 'ready' as const,
      article: currentArticle,
      attempt: latestAttempt,
    };
  }

  const totalAttempts = await db
    .select({ count: count() })
    .from(attempts)
    .where(eq(attempts.studentId, studentId))
    .get();

  const usedAttempts = totalAttempts?.count ?? 0;

  if (usedAttempts >= MAX_ATTEMPTS_PER_STUDENT) {
    return {
      state: 'locked' as const,
      article: currentArticle,
      latestAttempt,
    };
  }

  const attemptNo = usedAttempts + 1;

  await db.insert(attempts).values({
    studentId: student.id,
    articleId: currentArticle.articleId,
    attemptNo,
    status: 'started',
    studentNoSnapshot: student.studentNo,
    studentNameSnapshot: student.name,
    campusEmailSnapshot: student.campusEmail,
    articleTitleSnapshot: currentArticle.title,
    durationSecondsAllocated: TEST_DURATION_SECONDS,
    typedTextRaw: '',
    typedTextNormalized: '',
    suspicionFlags: [],
    clientMeta: {},
  });

  const attempt = await db.query.attempts.findFirst({
    where: and(eq(attempts.studentId, student.id), eq(attempts.attemptNo, attemptNo)),
  });

  return {
    state: 'ready' as const,
    article: currentArticle,
    attempt,
  };
}

export async function getAttemptDetail(attemptId: number) {
  return db
    .select({
      attemptId: attempts.id,
      articleId: attempts.articleId,
      articleTitle: attempts.articleTitleSnapshot,
      studentId: attempts.studentId,
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
    .leftJoin(articles, eq(articles.id, attempts.articleId))
    .where(eq(attempts.id, attemptId))
    .get();
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const rows = await db
    .select({
      attemptId: attempts.id,
      studentId: attempts.studentId,
      studentNo: attempts.studentNoSnapshot,
      studentName: attempts.studentNameSnapshot,
      campusEmail: attempts.campusEmailSnapshot,
      scoreKpm: attempts.scoreKpm,
      accuracy: attempts.accuracy,
      submittedAt: attempts.submittedAt,
      attemptNo: attempts.attemptNo,
    })
    .from(attempts)
    .where(eq(attempts.status, 'submitted'))
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

export async function getExportRows() {
  return db
    .select({
      studentNo: attempts.studentNoSnapshot,
      studentName: attempts.studentNameSnapshot,
      campusEmail: attempts.campusEmailSnapshot,
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
    .orderBy(desc(attempts.createdAt));
}
