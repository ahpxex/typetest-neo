import { and, asc, count, desc, eq, inArray, like, or, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { adminUsers, articles, attempts, students } from '@/db/schema';
import { MAX_ATTEMPTS_PER_STUDENT, TEST_DURATION_SECONDS } from '@/lib/env';
import type { AttemptMode } from '@/lib/attempt-mode';

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

export type PracticeArticleOption = {
  articleId: number;
  title: string;
  slug: string;
};

export type LeaderboardEntry = {
  rank: number;
  studentId: number;
  studentNo: string;
  name: string;
  campusEmail: string;
  attemptId: number;
  mode: AttemptMode;
  scoreKpm: number;
  accuracy: number;
  submittedAt: Date | null;
  attemptNo: number;
};

export type StudentRecentAttemptSummary = {
  attemptId: number;
  mode: AttemptMode;
  articleTitle: string;
  status: 'started' | 'submitted' | 'expired' | 'cancelled' | 'invalidated';
  scoreKpm: number;
  accuracy: number;
  startedAt: Date;
  submittedAt: Date | null;
};

export type StudentDashboardSnapshot = {
  studentId: number;
  studentNo: string;
  studentName: string;
  campusEmail: string;
  enrollmentYear: string;
  schoolCode: string;
  majorCode: string;
  bestPracticeScoreKpm: number | null;
  bestPracticeAccuracy: number | null;
  bestExamScoreKpm: number | null;
  bestExamAccuracy: number | null;
  practiceAttempts: StudentRecentAttemptSummary[];
  examAttempts: StudentRecentAttemptSummary[];
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

export async function getPracticeArticles(): Promise<PracticeArticleOption[]> {
  const pool = await getRotatingArticlePool();

  return pool.map((article) => ({
    articleId: article.articleId,
    title: article.title,
    slug: article.slug,
  }));
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
  enrollmentYear: string;
  schoolCode: string;
  majorCode: string;
  status: 'active' | 'inactive';
  notes: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  bestSubmittedScoreKpm: number | null;
  bestSubmittedAccuracy: number | null;
  submittedAttemptCount: number;
  practiceAttemptCount: number;
  examAttemptCount: number;
  totalAttemptCount: number;
};

export type AdminStudentFilterOptions = {
  enrollmentYears: string[];
  schoolCodes: string[];
  majorCodes: string[];
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
  mode: AttemptMode;
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

function buildAdminStudentFilter({
  search,
  enrollmentYear,
  schoolCode,
  majorCode,
}: {
  search?: string;
  enrollmentYear?: string;
  schoolCode?: string;
  majorCode?: string;
}) {
  const conditions = [];
  const keyword = search?.trim();

  if (keyword) {
    conditions.push(
      or(
        like(students.studentNo, `%${keyword}%`),
        like(students.name, `%${keyword}%`),
        like(students.campusEmail, `%${keyword}%`),
      ),
    );
  }

  if (enrollmentYear?.trim()) {
    conditions.push(eq(students.enrollmentYear, enrollmentYear.trim()));
  }

  if (schoolCode?.trim()) {
    conditions.push(eq(students.schoolCode, schoolCode.trim()));
  }

  if (majorCode?.trim()) {
    conditions.push(eq(students.majorCode, majorCode.trim()));
  }

  if (conditions.length === 0) {
    return undefined;
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return and(...conditions);
}

export async function getAdminStudentFilterOptions(): Promise<AdminStudentFilterOptions> {
  const rows = await db
    .select({
      enrollmentYear: students.enrollmentYear,
      schoolCode: students.schoolCode,
      majorCode: students.majorCode,
    })
    .from(students)
    .orderBy(asc(students.enrollmentYear), asc(students.schoolCode), asc(students.majorCode));

  return {
    enrollmentYears: Array.from(new Set(rows.map((row) => row.enrollmentYear))).filter(Boolean),
    schoolCodes: Array.from(new Set(rows.map((row) => row.schoolCode))).filter(Boolean),
    majorCodes: Array.from(new Set(rows.map((row) => row.majorCode))).filter(Boolean),
  };
}

export async function getAdminStudentsPage({
  search,
  enrollmentYear,
  schoolCode,
  majorCode,
  page = 1,
  pageSize = ADMIN_STUDENTS_PAGE_SIZE,
}: {
  search?: string;
  enrollmentYear?: string;
  schoolCode?: string;
  majorCode?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<AdminStudentsPage> {
  const filter = buildAdminStudentFilter({ search, enrollmentYear, schoolCode, majorCode });

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
      enrollmentYear: students.enrollmentYear,
      schoolCode: students.schoolCode,
      majorCode: students.majorCode,
      status: students.status,
      notes: students.notes,
      lastLoginAt: students.lastLoginAt,
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
      mode: attempts.mode,
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
      practiceAttemptCount: number;
      examAttemptCount: number;
      totalAttemptCount: number;
  }>();

  for (const attempt of attemptRows) {
    const current = statsByStudent.get(attempt.studentId) ?? {
      bestSubmittedScoreKpm: null,
      bestSubmittedAccuracy: null,
      bestSubmittedAt: null,
      submittedAttemptCount: 0,
      practiceAttemptCount: 0,
      examAttemptCount: 0,
      totalAttemptCount: 0,
    };

    current.totalAttemptCount += 1;

    if (attempt.mode === 'practice') {
      current.practiceAttemptCount += 1;
    } else {
      current.examAttemptCount += 1;
    }

    if (attempt.status === 'submitted' && attempt.mode === 'exam') {
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
        practiceAttemptCount: stats?.practiceAttemptCount ?? 0,
        examAttemptCount: stats?.examAttemptCount ?? 0,
        totalAttemptCount: stats?.totalAttemptCount ?? 0,
      } satisfies AdminStudentSummary;
    }),
    total,
    page: resolvedPage,
    pageSize: safePageSize,
    totalPages,
  };
}

export async function getAdminStudentAttemptSummaries(studentNo: string): Promise<AdminStudentAttemptSummary[]> {
  const normalizedStudentNo = studentNo.trim();

  if (!normalizedStudentNo) {
    return [];
  }

  return db
    .select({
      id: attempts.id,
      mode: attempts.mode,
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
    .where(eq(attempts.studentNoSnapshot, normalizedStudentNo))
    .orderBy(desc(attempts.attemptNo), desc(attempts.createdAt));
}

export async function getStudentDashboard(studentId: number): Promise<StudentDashboardSnapshot | null> {
  const [student, recentAttempts] = await Promise.all([
    db.query.students.findFirst({ where: eq(students.id, studentId) }),
    db
      .select({
        attemptId: attempts.id,
        mode: attempts.mode,
        articleTitle: attempts.articleTitleSnapshot,
        status: attempts.status,
        scoreKpm: attempts.scoreKpm,
        accuracy: attempts.accuracy,
        startedAt: attempts.startedAt,
        submittedAt: attempts.submittedAt,
      })
      .from(attempts)
      .where(eq(attempts.studentId, studentId))
      .orderBy(desc(attempts.createdAt), desc(attempts.attemptNo))
      .limit(12),
  ]);

  if (!student) {
    return null;
  }

  let bestPracticeScoreKpm: number | null = null;
  let bestPracticeAccuracy: number | null = null;
  let bestExamScoreKpm: number | null = null;
  let bestExamAccuracy: number | null = null;

  const practiceAttempts: StudentRecentAttemptSummary[] = [];
  const examAttempts: StudentRecentAttemptSummary[] = [];

  for (const attempt of recentAttempts) {
    if (attempt.mode === 'practice' && practiceAttempts.length < 5) {
      practiceAttempts.push(attempt);
    }

    if (attempt.mode === 'exam' && examAttempts.length < 5) {
      examAttempts.push(attempt);
    }

    if (attempt.status !== 'submitted') {
      continue;
    }

    if (attempt.mode === 'practice') {
      const shouldReplace =
        bestPracticeScoreKpm === null
        || attempt.scoreKpm > bestPracticeScoreKpm
        || (attempt.scoreKpm === bestPracticeScoreKpm && attempt.accuracy > (bestPracticeAccuracy ?? 0));

      if (shouldReplace) {
        bestPracticeScoreKpm = attempt.scoreKpm;
        bestPracticeAccuracy = attempt.accuracy;
      }

      continue;
    }

    const shouldReplace =
      bestExamScoreKpm === null
      || attempt.scoreKpm > bestExamScoreKpm
      || (attempt.scoreKpm === bestExamScoreKpm && attempt.accuracy > (bestExamAccuracy ?? 0));

    if (shouldReplace) {
      bestExamScoreKpm = attempt.scoreKpm;
      bestExamAccuracy = attempt.accuracy;
    }
  }

  return {
    studentId: student.id,
    studentNo: student.studentNo,
    studentName: student.name,
    campusEmail: student.campusEmail,
    enrollmentYear: student.enrollmentYear,
    schoolCode: student.schoolCode,
    majorCode: student.majorCode,
    bestPracticeScoreKpm,
    bestPracticeAccuracy,
    bestExamScoreKpm,
    bestExamAccuracy,
    practiceAttempts,
    examAttempts,
  };
}

export async function ensureAttemptForStudent(studentId: number, mode: AttemptMode, practiceArticleId?: number) {
  const [student, currentArticle, practiceArticles, latestModeAttempt] = await Promise.all([
    db.query.students.findFirst({ where: eq(students.id, studentId) }),
    getCurrentRotatingArticle(),
    mode === 'practice' ? getRotatingArticlePool() : Promise.resolve<RotatingArticle[]>([]),
    db.query.attempts.findFirst({
      where: and(eq(attempts.studentId, studentId), eq(attempts.mode, mode)),
      orderBy: [desc(attempts.attemptNo), desc(attempts.createdAt)],
    }),
  ]);

  if (!student) {
    return { state: 'missing-student' as const };
  }

  const practiceTargetArticle = mode === 'practice'
    ? practiceArticles.find((article) => article.articleId === practiceArticleId)
      ?? (currentArticle ? practiceArticles.find((article) => article.articleId === currentArticle.articleId) : undefined)
      ?? practiceArticles[0]
      ?? null
    : null;

  const targetArticle = mode === 'practice' ? practiceTargetArticle : currentArticle;

  if (!targetArticle) {
    return { state: 'no-article' as const };
  }

  const latestStartedAttempt = await db
    .select({
      id: attempts.id,
      studentId: attempts.studentId,
      articleId: attempts.articleId,
      mode: attempts.mode,
      attemptNo: attempts.attemptNo,
      status: attempts.status,
      studentNoSnapshot: attempts.studentNoSnapshot,
      studentNameSnapshot: attempts.studentNameSnapshot,
      campusEmailSnapshot: attempts.campusEmailSnapshot,
      articleTitleSnapshot: attempts.articleTitleSnapshot,
      startedAt: attempts.startedAt,
      submittedAt: attempts.submittedAt,
      durationSecondsAllocated: attempts.durationSecondsAllocated,
      durationSecondsUsed: attempts.durationSecondsUsed,
      typedTextRaw: attempts.typedTextRaw,
      typedTextNormalized: attempts.typedTextNormalized,
      charCountTyped: attempts.charCountTyped,
      charCountCorrect: attempts.charCountCorrect,
      charCountError: attempts.charCountError,
      backspaceCount: attempts.backspaceCount,
      pasteCount: attempts.pasteCount,
      suspicionFlags: attempts.suspicionFlags,
      clientMeta: attempts.clientMeta,
      scoreKpm: attempts.scoreKpm,
      accuracy: attempts.accuracy,
      scoreVersion: attempts.scoreVersion,
      ipAddress: attempts.ipAddress,
      userAgent: attempts.userAgent,
      createdAt: attempts.createdAt,
      updatedAt: attempts.updatedAt,
      title: articles.title,
      slug: articles.slug,
      language: articles.language,
      articleStatus: articles.status,
      contentRaw: articles.contentRaw,
      source: articles.source,
    })
    .from(attempts)
    .innerJoin(articles, eq(articles.id, attempts.articleId))
    .where(
      and(
        eq(attempts.studentId, studentId),
        eq(attempts.mode, mode),
        eq(attempts.status, 'started'),
        mode === 'practice' ? eq(attempts.articleId, targetArticle.articleId) : undefined,
      ),
    )
    .orderBy(desc(attempts.createdAt), desc(attempts.attemptNo))
    .get();

  if (latestStartedAttempt) {
    return {
      state: 'ready' as const,
      article: {
        articleId: latestStartedAttempt.articleId,
        title: latestStartedAttempt.title,
        slug: latestStartedAttempt.slug,
        language: latestStartedAttempt.language,
        status: latestStartedAttempt.articleStatus,
        contentRaw: latestStartedAttempt.contentRaw,
        source: latestStartedAttempt.source,
      },
      attempt: {
        id: latestStartedAttempt.id,
        studentId: latestStartedAttempt.studentId,
        articleId: latestStartedAttempt.articleId,
        mode: latestStartedAttempt.mode,
        attemptNo: latestStartedAttempt.attemptNo,
        status: latestStartedAttempt.status,
        studentNoSnapshot: latestStartedAttempt.studentNoSnapshot,
        studentNameSnapshot: latestStartedAttempt.studentNameSnapshot,
        campusEmailSnapshot: latestStartedAttempt.campusEmailSnapshot,
        articleTitleSnapshot: latestStartedAttempt.articleTitleSnapshot,
        startedAt: latestStartedAttempt.startedAt,
        submittedAt: latestStartedAttempt.submittedAt,
        durationSecondsAllocated: latestStartedAttempt.durationSecondsAllocated,
        durationSecondsUsed: latestStartedAttempt.durationSecondsUsed,
        typedTextRaw: latestStartedAttempt.typedTextRaw,
        typedTextNormalized: latestStartedAttempt.typedTextNormalized,
        charCountTyped: latestStartedAttempt.charCountTyped,
        charCountCorrect: latestStartedAttempt.charCountCorrect,
        charCountError: latestStartedAttempt.charCountError,
        backspaceCount: latestStartedAttempt.backspaceCount,
        pasteCount: latestStartedAttempt.pasteCount,
        suspicionFlags: latestStartedAttempt.suspicionFlags,
        clientMeta: latestStartedAttempt.clientMeta,
        scoreKpm: latestStartedAttempt.scoreKpm,
        accuracy: latestStartedAttempt.accuracy,
        scoreVersion: latestStartedAttempt.scoreVersion,
        ipAddress: latestStartedAttempt.ipAddress,
        userAgent: latestStartedAttempt.userAgent,
        createdAt: latestStartedAttempt.createdAt,
        updatedAt: latestStartedAttempt.updatedAt,
      },
    };
  }

  const totalAttempts = await db
    .select({ count: count() })
    .from(attempts)
    .where(eq(attempts.studentId, studentId))
    .get();

  const usedExamAttempts = await db
    .select({ count: count() })
    .from(attempts)
    .where(and(eq(attempts.studentId, studentId), eq(attempts.mode, 'exam')))
    .get();

  const usedAttempts = totalAttempts?.count ?? 0;
  const usedExamAttemptCount = usedExamAttempts?.count ?? 0;

  if (mode === 'exam' && usedExamAttemptCount >= MAX_ATTEMPTS_PER_STUDENT) {
    return {
      state: 'locked' as const,
      article: targetArticle,
      latestAttempt: latestModeAttempt,
    };
  }

  const attemptNo = usedAttempts + 1;

  await db.insert(attempts).values({
    studentId: student.id,
    articleId: targetArticle.articleId,
    mode,
    attemptNo,
    status: 'started',
    studentNoSnapshot: student.studentNo,
    studentNameSnapshot: student.name,
    campusEmailSnapshot: student.campusEmail,
    articleTitleSnapshot: targetArticle.title,
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
    article: targetArticle,
    attempt,
  };
}

export async function getAttemptDetail(attemptId: number) {
  return db
    .select({
      attemptId: attempts.id,
      articleId: attempts.articleId,
      mode: attempts.mode,
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
      mode: attempts.mode,
      scoreKpm: attempts.scoreKpm,
      accuracy: attempts.accuracy,
      submittedAt: attempts.submittedAt,
      attemptNo: attempts.attemptNo,
    })
    .from(attempts)
    .where(and(eq(attempts.status, 'submitted'), eq(attempts.mode, 'exam')))
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
      mode: row.mode,
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
      enrollmentYear: students.enrollmentYear,
      schoolCode: students.schoolCode,
      majorCode: students.majorCode,
      mode: attempts.mode,
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
    .leftJoin(students, eq(students.id, attempts.studentId))
    .orderBy(desc(attempts.createdAt));
}
