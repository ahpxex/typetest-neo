import { and, asc, count, desc, eq, inArray, like, ne, or, sql } from 'drizzle-orm';

import { db, ensureDatabaseReady, withDatabaseRetry } from '@/db/client';
import { adminUsers, articles, attempts, competitions, students } from '@/db/schema';
import { MAX_ATTEMPTS_PER_STUDENT, TEST_DURATION_SECONDS } from '@/lib/env';
import type { AttemptMode } from '@/lib/attempt-mode';
import {
  getCompetitionPhase,
  isCompetitionVisibleToStudents,
  type CompetitionPhase,
  type CompetitionStatus,
} from '@/lib/competition';

type AttemptStatus = 'started' | 'submitted' | 'expired' | 'cancelled' | 'invalidated';

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
  const publishedArticles = await withDatabaseRetry('getRotatingArticlePool', async () => (
    db
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
      .orderBy(asc(articles.slug))
  ));

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
  return withDatabaseRetry('getStudentByIdentity', async () => (
    db.query.students.findFirst({
      where: and(
        eq(students.studentNo, input.studentNo.trim()),
        eq(students.name, input.name.trim()),
        eq(students.campusEmail, normalizedEmail(input.campusEmail)),
        eq(students.status, 'active'),
      ),
    })
  ));
}

export async function getAdminByUsername(username: string) {
  return withDatabaseRetry('getAdminByUsername', async () => (
    db.query.adminUsers.findFirst({
      where: and(eq(adminUsers.username, username.trim().toLowerCase()), eq(adminUsers.status, 'active')),
    })
  ));
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
  const rows = await withDatabaseRetry('getAdminStudentFilterOptions', async () => (
    db
      .select({
        enrollmentYear: students.enrollmentYear,
        schoolCode: students.schoolCode,
        majorCode: students.majorCode,
      })
      .from(students)
      .orderBy(asc(students.enrollmentYear), asc(students.schoolCode), asc(students.majorCode))
  ));

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

  const totalRow = await withDatabaseRetry('getAdminStudentsPage.total', async () => (
    db
      .select({ count: count() })
      .from(students)
      .where(filter)
      .get()
  ));

  const total = totalRow?.count ?? 0;
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const resolvedPage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const offset = (resolvedPage - 1) * safePageSize;

  const studentRows = await withDatabaseRetry('getAdminStudentsPage.students', async () => (
    db
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
      .offset(offset)
  ));

  if (studentRows.length === 0) {
    return {
      items: [],
      total,
      page: resolvedPage,
      pageSize: safePageSize,
      totalPages,
    };
  }

  const studentIds = studentRows.map((student) => student.id);

  const attemptCountRows = await withDatabaseRetry('getAdminStudentsPage.attemptCounts', async () => (
    db
      .select({
        studentId: attempts.studentId,
        submittedAttemptCount: sql<number>`
          cast(sum(case
            when ${attempts.mode} = 'exam' and ${attempts.status} = 'submitted' then 1
            else 0
          end) as int)
        `.as('submitted_attempt_count'),
        practiceAttemptCount: sql<number>`
          cast(sum(case
            when ${attempts.mode} = 'practice' then 1
            else 0
          end) as int)
        `.as('practice_attempt_count'),
        examAttemptCount: sql<number>`
          cast(sum(case
            when ${attempts.mode} = 'exam' then 1
            else 0
          end) as int)
        `.as('exam_attempt_count'),
        totalAttemptCount: sql<number>`cast(count(*) as int)`.as('total_attempt_count'),
      })
      .from(attempts)
      .where(inArray(attempts.studentId, studentIds))
      .groupBy(attempts.studentId)
  ));

  const rankedBestSubmittedExamAttempts = db.$with('ranked_best_submitted_exam_attempts').as(
    db
      .select({
        studentId: attempts.studentId,
        scoreKpm: attempts.scoreKpm,
        accuracy: attempts.accuracy,
        studentRank: sql<number>`
          row_number() over (
            partition by ${attempts.studentId}
            order by ${attempts.scoreKpm} desc, ${attempts.accuracy} desc, ${attempts.submittedAt} asc
          )
        `.as('student_rank'),
      })
      .from(attempts)
      .where(and(
        inArray(attempts.studentId, studentIds),
        eq(attempts.mode, 'exam'),
        eq(attempts.status, 'submitted'),
      )),
  );

  const bestSubmittedRows = await withDatabaseRetry('getAdminStudentsPage.bestSubmittedRows', async () => (
    db
      .with(rankedBestSubmittedExamAttempts)
      .select({
        studentId: rankedBestSubmittedExamAttempts.studentId,
        bestSubmittedScoreKpm: rankedBestSubmittedExamAttempts.scoreKpm,
        bestSubmittedAccuracy: rankedBestSubmittedExamAttempts.accuracy,
      })
      .from(rankedBestSubmittedExamAttempts)
      .where(eq(rankedBestSubmittedExamAttempts.studentRank, 1))
  ));

  const statsByStudent = new Map<number, {
    bestSubmittedScoreKpm: number | null;
    bestSubmittedAccuracy: number | null;
    submittedAttemptCount: number;
    practiceAttemptCount: number;
    examAttemptCount: number;
    totalAttemptCount: number;
  }>();

  for (const row of attemptCountRows) {
    statsByStudent.set(row.studentId, {
      bestSubmittedScoreKpm: null,
      bestSubmittedAccuracy: null,
      submittedAttemptCount: row.submittedAttemptCount ?? 0,
      practiceAttemptCount: row.practiceAttemptCount ?? 0,
      examAttemptCount: row.examAttemptCount ?? 0,
      totalAttemptCount: row.totalAttemptCount ?? 0,
    });
  }

  for (const row of bestSubmittedRows) {
    const current = statsByStudent.get(row.studentId) ?? {
      bestSubmittedScoreKpm: null,
      bestSubmittedAccuracy: null,
      submittedAttemptCount: 0,
      practiceAttemptCount: 0,
      examAttemptCount: 0,
      totalAttemptCount: 0,
    };

    current.bestSubmittedScoreKpm = row.bestSubmittedScoreKpm;
    current.bestSubmittedAccuracy = row.bestSubmittedAccuracy;

    statsByStudent.set(row.studentId, current);
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

  return withDatabaseRetry('getAdminStudentAttemptSummaries', async () => (
    db
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
      .orderBy(desc(attempts.attemptNo), desc(attempts.createdAt))
  ));
}

export async function getStudentDashboard(studentId: number): Promise<StudentDashboardSnapshot | null> {
  const [student, recentAttempts, bestPracticeAttempt, bestExamAttempt] = await Promise.all([
    withDatabaseRetry('getStudentDashboard.getStudent', async () => (
      db.query.students.findFirst({ where: eq(students.id, studentId) })
    )),
    withDatabaseRetry('getStudentDashboard.getRecentAttempts', async () => (
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
        .where(and(
          eq(attempts.studentId, studentId),
          inArray(attempts.mode, ['practice', 'exam']),
        ))
        .orderBy(desc(attempts.createdAt), desc(attempts.attemptNo))
        .limit(12)
    )),
    withDatabaseRetry('getStudentDashboard.getBestPracticeAttempt', async () => (
      db
        .select({
          scoreKpm: attempts.scoreKpm,
          accuracy: attempts.accuracy,
        })
        .from(attempts)
        .where(and(
          eq(attempts.studentId, studentId),
          eq(attempts.mode, 'practice'),
          eq(attempts.status, 'submitted'),
        ))
        .orderBy(desc(attempts.scoreKpm), desc(attempts.accuracy), asc(attempts.submittedAt))
        .limit(1)
        .get()
    )),
    withDatabaseRetry('getStudentDashboard.getBestExamAttempt', async () => (
      db
        .select({
          scoreKpm: attempts.scoreKpm,
          accuracy: attempts.accuracy,
        })
        .from(attempts)
        .where(and(
          eq(attempts.studentId, studentId),
          eq(attempts.mode, 'exam'),
          eq(attempts.status, 'submitted'),
        ))
        .orderBy(desc(attempts.scoreKpm), desc(attempts.accuracy), asc(attempts.submittedAt))
        .limit(1)
        .get()
    )),
  ]);

  if (!student) {
    return null;
  }

  const bestPracticeScoreKpm = bestPracticeAttempt?.scoreKpm ?? null;
  const bestPracticeAccuracy = bestPracticeAttempt?.accuracy ?? null;
  const bestExamScoreKpm = bestExamAttempt?.scoreKpm ?? null;
  const bestExamAccuracy = bestExamAttempt?.accuracy ?? null;

  const practiceAttempts: StudentRecentAttemptSummary[] = [];
  const examAttempts: StudentRecentAttemptSummary[] = [];

  for (const attempt of recentAttempts) {
    if (attempt.mode === 'practice' && practiceAttempts.length < 5) {
      practiceAttempts.push(attempt);
    }

    if (attempt.mode === 'exam' && examAttempts.length < 5) {
      examAttempts.push(attempt);
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

function isAttemptNumberConflict(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes('attempts_student_attempt_no_unique')
    || message.includes('unique constraint failed: attempts.student_id, attempts.attempt_no');
}

export async function ensureAttemptForStudent(studentId: number, mode: AttemptMode, practiceArticleId?: number) {
  await ensureDatabaseReady();

  const [student, currentArticle, practiceArticles, latestModeAttempt] = await Promise.all([
    withDatabaseRetry('ensureAttemptForStudent.getStudent', async () => (
      db.query.students.findFirst({ where: eq(students.id, studentId) })
    )),
    getCurrentRotatingArticle(),
    mode === 'practice' ? getRotatingArticlePool() : Promise.resolve<RotatingArticle[]>([]),
    withDatabaseRetry('ensureAttemptForStudent.getLatestModeAttempt', async () => (
      db.query.attempts.findFirst({
        where: and(eq(attempts.studentId, studentId), eq(attempts.mode, mode)),
        orderBy: [desc(attempts.attemptNo), desc(attempts.createdAt)],
      })
    )),
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

  const startedAttemptFilter = mode === 'practice'
    ? and(
        eq(attempts.studentId, studentId),
        eq(attempts.mode, mode),
        eq(attempts.status, 'started'),
        eq(attempts.articleId, targetArticle.articleId),
      )
    : and(
        eq(attempts.studentId, studentId),
        eq(attempts.mode, mode),
        eq(attempts.status, 'started'),
      );

  for (let insertAttempt = 1; insertAttempt <= 3; insertAttempt += 1) {
    try {
      return await withDatabaseRetry('ensureAttemptForStudent.transaction', async () => (
        db.transaction(async (tx) => {
          const latestStartedAttempt = await tx
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
            .where(startedAttemptFilter)
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

          const [maxAttemptRow, usedExamAttempts] = await Promise.all([
            tx
              .select({
                maxAttemptNo: sql<number>`coalesce(max(${attempts.attemptNo}), 0)`,
              })
              .from(attempts)
              .where(eq(attempts.studentId, studentId))
              .get(),
            tx
              .select({ count: count() })
              .from(attempts)
              .where(and(eq(attempts.studentId, studentId), eq(attempts.mode, 'exam')))
              .get(),
          ]);

          const usedExamAttemptCount = usedExamAttempts?.count ?? 0;
          if (mode === 'exam' && usedExamAttemptCount >= MAX_ATTEMPTS_PER_STUDENT) {
            return {
              state: 'locked' as const,
              article: targetArticle,
              latestAttempt: latestModeAttempt,
            };
          }

          const attemptNo = (maxAttemptRow?.maxAttemptNo ?? 0) + 1;

          await tx.insert(attempts).values({
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

          const attempt = await tx.query.attempts.findFirst({
            where: startedAttemptFilter,
            orderBy: [desc(attempts.createdAt), desc(attempts.attemptNo)],
          });

          if (!attempt) {
            throw new Error('Failed to create typing attempt.');
          }

          return {
            state: 'ready' as const,
            article: targetArticle,
            attempt,
          };
        })
      ));
    } catch (error) {
      if (!isAttemptNumberConflict(error) || insertAttempt === 3) {
        throw error;
      }
    }
  }

  throw new Error('Failed to allocate typing attempt number.');
}

export async function getAttemptDetail(attemptId: number) {
  return withDatabaseRetry('getAttemptDetail', async () => (
    db
      .select({
        attemptId: attempts.id,
        articleId: attempts.articleId,
        competitionId: attempts.competitionId,
        competitionTitle: competitions.title,
        competitionSlug: competitions.slug,
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
        suspicionFlags: attempts.suspicionFlags,
        scoreVersion: attempts.scoreVersion,
        articleContent: articles.contentRaw,
      })
      .from(attempts)
      .leftJoin(articles, eq(articles.id, attempts.articleId))
      .leftJoin(competitions, eq(competitions.id, attempts.competitionId))
      .where(eq(attempts.id, attemptId))
      .get()
  ));
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const rankedLeaderboardAttempts = db.$with('ranked_leaderboard_attempts').as(
    db
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
        studentRank: sql<number>`
          row_number() over (
            partition by ${attempts.studentId}
            order by ${attempts.scoreKpm} desc, ${attempts.accuracy} desc, ${attempts.submittedAt} asc
          )
        `.as('student_rank'),
      })
      .from(attempts)
      .where(and(eq(attempts.status, 'submitted'), eq(attempts.mode, 'exam'))),
  );

  const rows = await withDatabaseRetry('getLeaderboard', async () => (
    db
      .with(rankedLeaderboardAttempts)
      .select({
        attemptId: rankedLeaderboardAttempts.attemptId,
        studentId: rankedLeaderboardAttempts.studentId,
        studentNo: rankedLeaderboardAttempts.studentNo,
        name: rankedLeaderboardAttempts.studentName,
        campusEmail: rankedLeaderboardAttempts.campusEmail,
        mode: rankedLeaderboardAttempts.mode,
        scoreKpm: rankedLeaderboardAttempts.scoreKpm,
        accuracy: rankedLeaderboardAttempts.accuracy,
        submittedAt: rankedLeaderboardAttempts.submittedAt,
        attemptNo: rankedLeaderboardAttempts.attemptNo,
      })
      .from(rankedLeaderboardAttempts)
      .where(eq(rankedLeaderboardAttempts.studentRank, 1))
      .orderBy(
        desc(rankedLeaderboardAttempts.scoreKpm),
        desc(rankedLeaderboardAttempts.accuracy),
        asc(rankedLeaderboardAttempts.submittedAt),
      )
  ));

  return rows
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
  return withDatabaseRetry('getExportRows', async () => (
    db
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
        suspicionFlags: attempts.suspicionFlags,
        ipAddress: attempts.ipAddress,
      })
      .from(attempts)
      .leftJoin(students, eq(students.id, attempts.studentId))
      .orderBy(desc(attempts.createdAt))
  ));
}

// ---------------------------------------------------------------------------
// Article management (admin)
// ---------------------------------------------------------------------------

export type AdminArticleSummary = {
  id: number;
  title: string;
  slug: string;
  language: 'en' | 'zh';
  status: 'draft' | 'published' | 'archived';
  charCount: number;
  wordCount: number;
  difficultyLevel: number;
  source: string | null;
  attemptCount: number;
  competitionCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export async function getAdminArticles(): Promise<AdminArticleSummary[]> {
  const [articleRows, attemptCountRows, competitionCountRows] = await Promise.all([
    withDatabaseRetry('getAdminArticles.articles', async () => (
      db
        .select({
          id: articles.id,
          title: articles.title,
          slug: articles.slug,
          language: articles.language,
          status: articles.status,
          charCount: articles.charCount,
          wordCount: articles.wordCount,
          difficultyLevel: articles.difficultyLevel,
          source: articles.source,
          createdAt: articles.createdAt,
          updatedAt: articles.updatedAt,
        })
        .from(articles)
        .orderBy(desc(articles.updatedAt), asc(articles.title))
    )),
    withDatabaseRetry('getAdminArticles.attemptCounts', async () => (
      db
        .select({ articleId: attempts.articleId, total: sql<number>`cast(count(*) as int)`.as('total') })
        .from(attempts)
        .groupBy(attempts.articleId)
    )),
    withDatabaseRetry('getAdminArticles.competitionCounts', async () => (
      db
        .select({ articleId: competitions.articleId, total: sql<number>`cast(count(*) as int)`.as('total') })
        .from(competitions)
        .groupBy(competitions.articleId)
    )),
  ]);

  const attemptCountByArticle = new Map(attemptCountRows.map((row) => [row.articleId, row.total ?? 0]));
  const competitionCountByArticle = new Map(competitionCountRows.map((row) => [row.articleId, row.total ?? 0]));

  return articleRows.map((article) => ({
    ...article,
    attemptCount: attemptCountByArticle.get(article.id) ?? 0,
    competitionCount: competitionCountByArticle.get(article.id) ?? 0,
  }));
}

export type CompetitionArticleOption = {
  articleId: number;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  language: 'en' | 'zh';
  charCount: number;
};

export async function getArticleOptionsForCompetition(): Promise<CompetitionArticleOption[]> {
  return withDatabaseRetry('getArticleOptionsForCompetition', async () => (
    db
      .select({
        articleId: articles.id,
        title: articles.title,
        slug: articles.slug,
        status: articles.status,
        language: articles.language,
        charCount: articles.charCount,
      })
      .from(articles)
      .where(ne(articles.status, 'archived'))
      .orderBy(asc(articles.status), asc(articles.title))
  ));
}

// ---------------------------------------------------------------------------
// Competitions (admin)
// ---------------------------------------------------------------------------

export type AdminCompetitionSummary = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  status: CompetitionStatus;
  phase: CompetitionPhase;
  articleId: number;
  articleTitle: string;
  durationSeconds: number;
  maxAttemptsPerStudent: number;
  startAt: Date | null;
  endAt: Date | null;
  participantCount: number;
  attemptCount: number;
  bestScoreKpm: number | null;
  createdAt: Date;
  updatedAt: Date;
};

async function getCompetitionAttemptStats(competitionIds: number[]) {
  if (competitionIds.length === 0) {
    return new Map<number, { participantCount: number; attemptCount: number; bestScoreKpm: number | null }>();
  }

  const rows = await withDatabaseRetry('getCompetitionAttemptStats', async () => (
    db
      .select({
        competitionId: attempts.competitionId,
        attemptCount: sql<number>`cast(count(*) as int)`.as('attempt_count'),
        participantCount: sql<number>`cast(count(distinct ${attempts.studentId}) as int)`.as('participant_count'),
        bestScoreKpm: sql<number | null>`max(${attempts.scoreKpm})`.as('best_score_kpm'),
      })
      .from(attempts)
      .where(and(inArray(attempts.competitionId, competitionIds), eq(attempts.status, 'submitted')))
      .groupBy(attempts.competitionId)
  ));

  const stats = new Map<number, { participantCount: number; attemptCount: number; bestScoreKpm: number | null }>();
  for (const row of rows) {
    if (row.competitionId === null) {
      continue;
    }
    stats.set(row.competitionId, {
      participantCount: row.participantCount ?? 0,
      attemptCount: row.attemptCount ?? 0,
      bestScoreKpm: row.bestScoreKpm ?? null,
    });
  }
  return stats;
}

export async function getAdminCompetitions(): Promise<AdminCompetitionSummary[]> {
  const competitionRows = await withDatabaseRetry('getAdminCompetitions.competitions', async () => (
    db
      .select({
        id: competitions.id,
        title: competitions.title,
        slug: competitions.slug,
        description: competitions.description,
        status: competitions.status,
        articleId: competitions.articleId,
        articleTitleSnapshot: competitions.articleTitleSnapshot,
        articleCurrentTitle: articles.title,
        durationSeconds: competitions.durationSeconds,
        maxAttemptsPerStudent: competitions.maxAttemptsPerStudent,
        startAt: competitions.startAt,
        endAt: competitions.endAt,
        createdAt: competitions.createdAt,
        updatedAt: competitions.updatedAt,
      })
      .from(competitions)
      .leftJoin(articles, eq(articles.id, competitions.articleId))
      .orderBy(desc(competitions.createdAt))
  ));

  const stats = await getCompetitionAttemptStats(competitionRows.map((row) => row.id));
  const now = new Date();

  return competitionRows.map((row) => {
    const competitionStats = stats.get(row.id);
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      description: row.description,
      status: row.status,
      phase: getCompetitionPhase({ status: row.status, startAt: row.startAt, endAt: row.endAt }, now),
      articleId: row.articleId,
      articleTitle: row.articleCurrentTitle ?? row.articleTitleSnapshot,
      durationSeconds: row.durationSeconds,
      maxAttemptsPerStudent: row.maxAttemptsPerStudent,
      startAt: row.startAt,
      endAt: row.endAt,
      participantCount: competitionStats?.participantCount ?? 0,
      attemptCount: competitionStats?.attemptCount ?? 0,
      bestScoreKpm: competitionStats?.bestScoreKpm ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } satisfies AdminCompetitionSummary;
  });
}

export async function getCompetitionForEditing(competitionId: number) {
  return withDatabaseRetry('getCompetitionForEditing', async () => (
    db.query.competitions.findFirst({ where: eq(competitions.id, competitionId) })
  ));
}

// ---------------------------------------------------------------------------
// Competition leaderboard (shared by student + admin views)
// ---------------------------------------------------------------------------

export async function getCompetitionLeaderboard(competitionId: number): Promise<LeaderboardEntry[]> {
  const rankedCompetitionAttempts = db.$with('ranked_competition_attempts').as(
    db
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
        studentRank: sql<number>`
          row_number() over (
            partition by ${attempts.studentId}
            order by ${attempts.scoreKpm} desc, ${attempts.accuracy} desc, ${attempts.submittedAt} asc
          )
        `.as('student_rank'),
      })
      .from(attempts)
      .where(and(eq(attempts.competitionId, competitionId), eq(attempts.status, 'submitted'))),
  );

  const rows = await withDatabaseRetry('getCompetitionLeaderboard', async () => (
    db
      .with(rankedCompetitionAttempts)
      .select({
        attemptId: rankedCompetitionAttempts.attemptId,
        studentId: rankedCompetitionAttempts.studentId,
        studentNo: rankedCompetitionAttempts.studentNo,
        name: rankedCompetitionAttempts.studentName,
        campusEmail: rankedCompetitionAttempts.campusEmail,
        mode: rankedCompetitionAttempts.mode,
        scoreKpm: rankedCompetitionAttempts.scoreKpm,
        accuracy: rankedCompetitionAttempts.accuracy,
        submittedAt: rankedCompetitionAttempts.submittedAt,
        attemptNo: rankedCompetitionAttempts.attemptNo,
      })
      .from(rankedCompetitionAttempts)
      .where(eq(rankedCompetitionAttempts.studentRank, 1))
      .orderBy(
        desc(rankedCompetitionAttempts.scoreKpm),
        desc(rankedCompetitionAttempts.accuracy),
        asc(rankedCompetitionAttempts.submittedAt),
      )
  ));

  return rows
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

// ---------------------------------------------------------------------------
// Competitions (student)
// ---------------------------------------------------------------------------

export type StudentCompetitionSummary = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  status: CompetitionStatus;
  phase: CompetitionPhase;
  articleTitle: string;
  durationSeconds: number;
  maxAttemptsPerStudent: number;
  startAt: Date | null;
  endAt: Date | null;
  participantCount: number;
  yourAttemptCount: number;
  yourBestScoreKpm: number | null;
  yourBestAccuracy: number | null;
  yourBestAttemptId: number | null;
};

const STUDENT_COMPETITION_PHASE_ORDER: Record<CompetitionPhase, number> = {
  open: 0,
  upcoming: 1,
  ended: 2,
  closed: 3,
  hidden: 4,
};

type StudentCompetitionAttemptRow = {
  competitionId: number | null;
  attemptId: number;
  status: AttemptStatus;
  scoreKpm: number;
  accuracy: number;
  attemptNo: number;
  startedAt: Date;
  submittedAt: Date | null;
};

function summarizeStudentCompetitionAttempts(rows: StudentCompetitionAttemptRow[]) {
  const byCompetition = new Map<number, {
    attemptCount: number;
    bestScoreKpm: number | null;
    bestAccuracy: number | null;
    bestAttemptId: number | null;
  }>();

  for (const row of rows) {
    if (row.competitionId === null) {
      continue;
    }

    const current = byCompetition.get(row.competitionId) ?? {
      attemptCount: 0,
      bestScoreKpm: null,
      bestAccuracy: null,
      bestAttemptId: null,
    };

    current.attemptCount += 1;

    if (row.status === 'submitted') {
      const isBetter = current.bestScoreKpm === null
        || row.scoreKpm > current.bestScoreKpm
        || (row.scoreKpm === current.bestScoreKpm && row.accuracy > (current.bestAccuracy ?? 0));

      if (isBetter) {
        current.bestScoreKpm = row.scoreKpm;
        current.bestAccuracy = row.accuracy;
        current.bestAttemptId = row.attemptId;
      }
    }

    byCompetition.set(row.competitionId, current);
  }

  return byCompetition;
}

export async function getStudentCompetitions(studentId: number): Promise<StudentCompetitionSummary[]> {
  const competitionRows = await withDatabaseRetry('getStudentCompetitions.competitions', async () => (
    db
      .select({
        id: competitions.id,
        title: competitions.title,
        slug: competitions.slug,
        description: competitions.description,
        status: competitions.status,
        articleTitleSnapshot: competitions.articleTitleSnapshot,
        articleCurrentTitle: articles.title,
        durationSeconds: competitions.durationSeconds,
        maxAttemptsPerStudent: competitions.maxAttemptsPerStudent,
        startAt: competitions.startAt,
        endAt: competitions.endAt,
      })
      .from(competitions)
      .leftJoin(articles, eq(articles.id, competitions.articleId))
      .where(inArray(competitions.status, ['published', 'closed']))
      .orderBy(desc(competitions.createdAt))
  ));

  if (competitionRows.length === 0) {
    return [];
  }

  const competitionIds = competitionRows.map((row) => row.id);

  const [stats, studentAttemptRows] = await Promise.all([
    getCompetitionAttemptStats(competitionIds),
    withDatabaseRetry('getStudentCompetitions.studentAttempts', async () => (
      db
        .select({
          competitionId: attempts.competitionId,
          attemptId: attempts.id,
          status: attempts.status,
          scoreKpm: attempts.scoreKpm,
          accuracy: attempts.accuracy,
          attemptNo: attempts.attemptNo,
          startedAt: attempts.startedAt,
          submittedAt: attempts.submittedAt,
        })
        .from(attempts)
        .where(and(eq(attempts.studentId, studentId), inArray(attempts.competitionId, competitionIds)))
    )),
  ]);

  const yourAttemptsByCompetition = summarizeStudentCompetitionAttempts(studentAttemptRows);
  const now = new Date();

  return competitionRows
    .map((row) => {
      const competitionStats = stats.get(row.id);
      const yourAttempts = yourAttemptsByCompetition.get(row.id);

      return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        description: row.description,
        status: row.status,
        phase: getCompetitionPhase({ status: row.status, startAt: row.startAt, endAt: row.endAt }, now),
        articleTitle: row.articleCurrentTitle ?? row.articleTitleSnapshot,
        durationSeconds: row.durationSeconds,
        maxAttemptsPerStudent: row.maxAttemptsPerStudent,
        startAt: row.startAt,
        endAt: row.endAt,
        participantCount: competitionStats?.participantCount ?? 0,
        yourAttemptCount: yourAttempts?.attemptCount ?? 0,
        yourBestScoreKpm: yourAttempts?.bestScoreKpm ?? null,
        yourBestAccuracy: yourAttempts?.bestAccuracy ?? null,
        yourBestAttemptId: yourAttempts?.bestAttemptId ?? null,
      } satisfies StudentCompetitionSummary;
    })
    .sort((left, right) => {
      const orderDifference = STUDENT_COMPETITION_PHASE_ORDER[left.phase] - STUDENT_COMPETITION_PHASE_ORDER[right.phase];
      if (orderDifference !== 0) {
        return orderDifference;
      }
      return (right.startAt?.getTime() ?? 0) - (left.startAt?.getTime() ?? 0);
    });
}

export type CompetitionStudentAttempt = {
  attemptId: number;
  attemptNo: number;
  status: AttemptStatus;
  scoreKpm: number;
  accuracy: number;
  startedAt: Date;
  submittedAt: Date | null;
};

export type StudentCompetitionDetail = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  status: CompetitionStatus;
  phase: CompetitionPhase;
  articleTitle: string;
  durationSeconds: number;
  maxAttemptsPerStudent: number;
  startAt: Date | null;
  endAt: Date | null;
  participantCount: number;
  leaderboard: LeaderboardEntry[];
  yourAttempts: CompetitionStudentAttempt[];
  yourAttemptCount: number;
  yourBestScoreKpm: number | null;
  yourBestAccuracy: number | null;
  yourBestAttemptId: number | null;
  yourRank: number | null;
};

export async function getStudentCompetitionDetail(
  competitionId: number,
  studentId: number,
): Promise<StudentCompetitionDetail | null> {
  const competition = await withDatabaseRetry('getStudentCompetitionDetail.competition', async () => (
    db
      .select({
        id: competitions.id,
        title: competitions.title,
        slug: competitions.slug,
        description: competitions.description,
        status: competitions.status,
        articleTitleSnapshot: competitions.articleTitleSnapshot,
        articleCurrentTitle: articles.title,
        durationSeconds: competitions.durationSeconds,
        maxAttemptsPerStudent: competitions.maxAttemptsPerStudent,
        startAt: competitions.startAt,
        endAt: competitions.endAt,
      })
      .from(competitions)
      .leftJoin(articles, eq(articles.id, competitions.articleId))
      .where(eq(competitions.id, competitionId))
      .get()
  ));

  if (!competition || !isCompetitionVisibleToStudents(competition.status)) {
    return null;
  }

  const [leaderboard, yourAttemptRows] = await Promise.all([
    getCompetitionLeaderboard(competitionId),
    withDatabaseRetry('getStudentCompetitionDetail.yourAttempts', async () => (
      db
        .select({
          attemptId: attempts.id,
          attemptNo: attempts.attemptNo,
          status: attempts.status,
          scoreKpm: attempts.scoreKpm,
          accuracy: attempts.accuracy,
          startedAt: attempts.startedAt,
          submittedAt: attempts.submittedAt,
        })
        .from(attempts)
        .where(and(eq(attempts.studentId, studentId), eq(attempts.competitionId, competitionId)))
        .orderBy(desc(attempts.attemptNo))
    )),
  ]);

  const yourSummary = summarizeStudentCompetitionAttempts(
    yourAttemptRows.map((row) => ({ ...row, competitionId })),
  ).get(competitionId);

  const yourRank = leaderboard.find((entry) => entry.studentId === studentId)?.rank ?? null;

  return {
    id: competition.id,
    title: competition.title,
    slug: competition.slug,
    description: competition.description,
    status: competition.status,
    phase: getCompetitionPhase({
      status: competition.status,
      startAt: competition.startAt,
      endAt: competition.endAt,
    }),
    articleTitle: competition.articleCurrentTitle ?? competition.articleTitleSnapshot,
    durationSeconds: competition.durationSeconds,
    maxAttemptsPerStudent: competition.maxAttemptsPerStudent,
    startAt: competition.startAt,
    endAt: competition.endAt,
    participantCount: leaderboard.length,
    leaderboard,
    yourAttempts: yourAttemptRows,
    yourAttemptCount: yourSummary?.attemptCount ?? 0,
    yourBestScoreKpm: yourSummary?.bestScoreKpm ?? null,
    yourBestAccuracy: yourSummary?.bestAccuracy ?? null,
    yourBestAttemptId: yourSummary?.bestAttemptId ?? null,
    yourRank,
  };
}

// ---------------------------------------------------------------------------
// Competition attempt allocation (student typing flow)
// ---------------------------------------------------------------------------

type CompetitionAttemptContext = {
  id: number;
  title: string;
  slug: string;
  durationSeconds: number;
  maxAttemptsPerStudent: number;
  status: CompetitionStatus;
  phase: CompetitionPhase;
};

type CompetitionAttemptArticle = {
  articleId: number;
  title: string;
  slug: string;
  language: 'en' | 'zh';
  status: 'draft' | 'published' | 'archived';
  contentRaw: string;
  source: string | null;
};

export type EnsureCompetitionAttemptResult =
  | { state: 'missing-student' }
  | { state: 'not-found' }
  | { state: 'no-article' }
  | { state: 'not-open'; phase: CompetitionPhase; competition: CompetitionAttemptContext }
  | { state: 'locked'; competition: CompetitionAttemptContext; latestAttempt: typeof attempts.$inferSelect | undefined }
  | {
      state: 'ready';
      competition: CompetitionAttemptContext;
      article: CompetitionAttemptArticle;
      attempt: typeof attempts.$inferSelect;
    };

export async function ensureCompetitionAttemptForStudent(
  studentId: number,
  competitionId: number,
): Promise<EnsureCompetitionAttemptResult> {
  await ensureDatabaseReady();

  const [student, competitionRow] = await Promise.all([
    withDatabaseRetry('ensureCompetitionAttempt.getStudent', async () => (
      db.query.students.findFirst({ where: eq(students.id, studentId) })
    )),
    withDatabaseRetry('ensureCompetitionAttempt.getCompetition', async () => (
      db.query.competitions.findFirst({ where: eq(competitions.id, competitionId) })
    )),
  ]);

  if (!student) {
    return { state: 'missing-student' };
  }

  if (!competitionRow || !isCompetitionVisibleToStudents(competitionRow.status)) {
    return { state: 'not-found' };
  }

  const articleRow = await withDatabaseRetry('ensureCompetitionAttempt.getArticle', async () => (
    db
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
      .where(eq(articles.id, competitionRow.articleId))
      .get()
  ));

  if (!articleRow || articleRow.status === 'archived') {
    return { state: 'no-article' };
  }

  const phase = getCompetitionPhase(competitionRow);
  const competitionContext: CompetitionAttemptContext = {
    id: competitionRow.id,
    title: competitionRow.title,
    slug: competitionRow.slug,
    durationSeconds: competitionRow.durationSeconds,
    maxAttemptsPerStudent: competitionRow.maxAttemptsPerStudent,
    status: competitionRow.status,
    phase,
  };

  const startedAttemptFilter = and(
    eq(attempts.studentId, studentId),
    eq(attempts.mode, 'competition'),
    eq(attempts.competitionId, competitionId),
    eq(attempts.status, 'started'),
  );

  for (let insertAttempt = 1; insertAttempt <= 3; insertAttempt += 1) {
    try {
      return await withDatabaseRetry('ensureCompetitionAttempt.transaction', async () => (
        db.transaction(async (tx) => {
          const existingStartedAttempt = await tx.query.attempts.findFirst({
            where: startedAttemptFilter,
            orderBy: [desc(attempts.createdAt), desc(attempts.attemptNo)],
          });

          // Resume an in-progress attempt regardless of the current phase so a
          // student is never locked out of submitting a run they already began.
          if (existingStartedAttempt) {
            return {
              state: 'ready' as const,
              competition: competitionContext,
              article: articleRow,
              attempt: existingStartedAttempt,
            };
          }

          if (phase !== 'open') {
            return { state: 'not-open' as const, phase, competition: competitionContext };
          }

          const [maxAttemptRow, usedAttempts] = await Promise.all([
            tx
              .select({ maxAttemptNo: sql<number>`coalesce(max(${attempts.attemptNo}), 0)` })
              .from(attempts)
              .where(eq(attempts.studentId, studentId))
              .get(),
            tx
              .select({ count: count() })
              .from(attempts)
              .where(and(eq(attempts.studentId, studentId), eq(attempts.competitionId, competitionId)))
              .get(),
          ]);

          const usedAttemptCount = usedAttempts?.count ?? 0;
          if (usedAttemptCount >= competitionRow.maxAttemptsPerStudent) {
            const latestAttempt = await tx.query.attempts.findFirst({
              where: and(eq(attempts.studentId, studentId), eq(attempts.competitionId, competitionId)),
              orderBy: [desc(attempts.attemptNo), desc(attempts.createdAt)],
            });

            return {
              state: 'locked' as const,
              competition: competitionContext,
              latestAttempt,
            };
          }

          const attemptNo = (maxAttemptRow?.maxAttemptNo ?? 0) + 1;

          await tx.insert(attempts).values({
            studentId: student.id,
            articleId: articleRow.articleId,
            competitionId,
            mode: 'competition',
            attemptNo,
            status: 'started',
            studentNoSnapshot: student.studentNo,
            studentNameSnapshot: student.name,
            campusEmailSnapshot: student.campusEmail,
            articleTitleSnapshot: articleRow.title,
            durationSecondsAllocated: competitionRow.durationSeconds,
            typedTextRaw: '',
            typedTextNormalized: '',
            suspicionFlags: [],
            clientMeta: {},
          });

          const attempt = await tx.query.attempts.findFirst({
            where: startedAttemptFilter,
            orderBy: [desc(attempts.createdAt), desc(attempts.attemptNo)],
          });

          if (!attempt) {
            throw new Error('Failed to create competition attempt.');
          }

          return {
            state: 'ready' as const,
            competition: competitionContext,
            article: articleRow,
            attempt,
          };
        })
      ));
    } catch (error) {
      if (!isAttemptNumberConflict(error) || insertAttempt === 3) {
        throw error;
      }
    }
  }

  throw new Error('Failed to allocate competition attempt number.');
}
