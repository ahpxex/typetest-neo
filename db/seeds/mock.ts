import { asc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { articles, attempts, students } from '@/db/schema';

const MOCK_NOTES = 'seed:mock';
const DEFAULT_COUNT = 1000;
const STUDENT_INSERT_CHUNK_SIZE = 500;
const ATTEMPT_INSERT_CHUNK_SIZE = 500;
const ATTEMPT_DELETE_CHUNK_SIZE = 500;
const DURATION_SECONDS_ALLOCATED = 180;

type MockStudentRow = {
  id: number;
  studentNo: string;
  name: string;
  campusEmail: string;
};

type ArticleRow = {
  id: number;
  title: string;
  contentRaw: string;
};

function parseTargetCount() {
  const raw = process.argv[2];
  const parsed = Number.parseInt(raw ?? '', 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_COUNT;
  }

  return parsed;
}

function chunk<T>(values: T[], size: number) {
  const result: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }

  return result;
}

function buildStudentNo(index: number) {
  return `20261${String(index).padStart(6, '0')}`;
}

function buildCampusEmail(index: number) {
  return `mock.${String(index).padStart(5, '0')}@ucass.edu.cn`;
}

function buildStudentName(index: number) {
  return `模拟学生${index}`;
}

function pickArticle(index: number, articlePool: ArticleRow[]) {
  return articlePool[index % articlePool.length] ?? articlePool[0];
}

function buildStartedAt(index: number, attemptNo: number) {
  const now = Date.now();
  const dayOffset = (index * 17 + attemptNo * 3) % 90;
  const minuteOffset = (index * 11 + attemptNo * 29) % 720;

  return new Date(now - dayOffset * 24 * 60 * 60 * 1000 - minuteOffset * 60 * 1000);
}

function buildSubmittedMetrics(index: number, attemptNo: number) {
  const durationSecondsUsed = 95 + ((index * 7 + attemptNo * 13) % 80);
  const scoreKpm = 165 + ((index * 19 + attemptNo * 23) % 220);
  const accuracyBasis = 900 + ((index * 17 + attemptNo * 11) % 95);
  const accuracy = Number((accuracyBasis / 10).toFixed(1));
  const charCountTyped = Math.max(1, Math.round((scoreKpm * durationSecondsUsed) / 60));
  const charCountCorrect = Math.max(0, Math.min(charCountTyped, Math.round(charCountTyped * (accuracy / 100))));
  const charCountError = Math.max(0, charCountTyped - charCountCorrect);
  const backspaceCount = (index * 3 + attemptNo) % 12;
  const pasteCount = index % 97 === 0 ? 1 : 0;
  const suspicionFlags = [
    ...(pasteCount > 0 ? ['paste_detected'] : []),
    ...(scoreKpm >= 360 ? ['score_unusually_high'] : []),
  ];

  return {
    durationSecondsUsed,
    scoreKpm,
    accuracy,
    charCountTyped,
    charCountCorrect,
    charCountError,
    backspaceCount,
    pasteCount,
    suspicionFlags,
  };
}

async function getPublishedArticles() {
  const publishedArticles = await db
    .select({
      id: articles.id,
      title: articles.title,
      contentRaw: articles.contentRaw,
    })
    .from(articles)
    .where(eq(articles.status, 'published'))
    .orderBy(asc(articles.slug));

  if (publishedArticles.length === 0) {
    throw new Error('No published articles found. Run the dev/article seed first.');
  }

  return publishedArticles;
}

async function clearPreviousMockData() {
  const mockStudents = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.notes, MOCK_NOTES));

  if (mockStudents.length === 0) {
    return;
  }

  const studentIds = mockStudents.map((student) => student.id);

  for (const idChunk of chunk(studentIds, ATTEMPT_DELETE_CHUNK_SIZE)) {
    await db.delete(attempts).where(inArray(attempts.studentId, idChunk));
  }

  for (const idChunk of chunk(studentIds, ATTEMPT_DELETE_CHUNK_SIZE)) {
    await db.delete(students).where(inArray(students.id, idChunk));
  }
}

async function seedMockStudents(targetCount: number) {
  const rows = Array.from({ length: targetCount }, (_, offset) => {
    const index = offset + 1;

    return {
      studentNo: buildStudentNo(index),
      name: buildStudentName(index),
      campusEmail: buildCampusEmail(index),
      status: index % 19 === 0 ? 'inactive' as const : 'active' as const,
      notes: MOCK_NOTES,
    };
  });

  for (const rowChunk of chunk(rows, STUDENT_INSERT_CHUNK_SIZE)) {
    await db.insert(students).values(rowChunk);
  }
}

async function getMockStudents() {
  return db
    .select({
      id: students.id,
      studentNo: students.studentNo,
      name: students.name,
      campusEmail: students.campusEmail,
    })
    .from(students)
    .where(eq(students.notes, MOCK_NOTES))
    .orderBy(asc(students.studentNo));
}

function buildAttemptRows(mockStudents: MockStudentRow[], articlePool: ArticleRow[]) {
  const rows = [];

  for (const [offset, student] of mockStudents.entries()) {
    const index = offset + 1;
    const primaryArticle = pickArticle(index, articlePool);
    const primaryStartedAt = buildStartedAt(index, 1);
    const primaryMetrics = buildSubmittedMetrics(index, 1);

    rows.push({
      studentId: student.id,
      articleId: primaryArticle.id,
      attemptNo: 1,
      status: 'submitted' as const,
      studentNoSnapshot: student.studentNo,
      studentNameSnapshot: student.name,
      campusEmailSnapshot: student.campusEmail,
      articleTitleSnapshot: primaryArticle.title,
      startedAt: primaryStartedAt,
      submittedAt: new Date(primaryStartedAt.getTime() + primaryMetrics.durationSecondsUsed * 1000),
      durationSecondsAllocated: DURATION_SECONDS_ALLOCATED,
      durationSecondsUsed: primaryMetrics.durationSecondsUsed,
      typedTextRaw: '',
      typedTextNormalized: '',
      charCountTyped: primaryMetrics.charCountTyped,
      charCountCorrect: primaryMetrics.charCountCorrect,
      charCountError: primaryMetrics.charCountError,
      backspaceCount: primaryMetrics.backspaceCount,
      pasteCount: primaryMetrics.pasteCount,
      suspicionFlags: primaryMetrics.suspicionFlags,
      clientMeta: { seed: 'mock', batch: 'primary' },
      scoreKpm: primaryMetrics.scoreKpm,
      accuracy: primaryMetrics.accuracy,
      scoreVersion: 'seed:mock',
      createdAt: primaryStartedAt,
      updatedAt: new Date(primaryStartedAt.getTime() + primaryMetrics.durationSecondsUsed * 1000),
    });

    if (index % 10 === 0) {
      const secondArticle = pickArticle(index + 3, articlePool);
      const secondStartedAt = buildStartedAt(index, 2);
      const secondMetrics = buildSubmittedMetrics(index, 2);

      rows.push({
        studentId: student.id,
        articleId: secondArticle.id,
        attemptNo: 2,
        status: 'submitted' as const,
        studentNoSnapshot: student.studentNo,
        studentNameSnapshot: student.name,
        campusEmailSnapshot: student.campusEmail,
        articleTitleSnapshot: secondArticle.title,
        startedAt: secondStartedAt,
        submittedAt: new Date(secondStartedAt.getTime() + secondMetrics.durationSecondsUsed * 1000),
        durationSecondsAllocated: DURATION_SECONDS_ALLOCATED,
        durationSecondsUsed: secondMetrics.durationSecondsUsed,
        typedTextRaw: '',
        typedTextNormalized: '',
        charCountTyped: secondMetrics.charCountTyped,
        charCountCorrect: secondMetrics.charCountCorrect,
        charCountError: secondMetrics.charCountError,
        backspaceCount: secondMetrics.backspaceCount,
        pasteCount: secondMetrics.pasteCount,
        suspicionFlags: secondMetrics.suspicionFlags,
        clientMeta: { seed: 'mock', batch: 'secondary' },
        scoreKpm: secondMetrics.scoreKpm,
        accuracy: secondMetrics.accuracy,
        scoreVersion: 'seed:mock',
        createdAt: secondStartedAt,
        updatedAt: new Date(secondStartedAt.getTime() + secondMetrics.durationSecondsUsed * 1000),
      });
    }

    if (index % 25 === 0) {
      const thirdArticle = pickArticle(index + 7, articlePool);
      const thirdStartedAt = buildStartedAt(index, 3);
      const thirdMetrics = buildSubmittedMetrics(index, 3);

      rows.push({
        studentId: student.id,
        articleId: thirdArticle.id,
        attemptNo: 3,
        status: 'invalidated' as const,
        studentNoSnapshot: student.studentNo,
        studentNameSnapshot: student.name,
        campusEmailSnapshot: student.campusEmail,
        articleTitleSnapshot: thirdArticle.title,
        startedAt: thirdStartedAt,
        submittedAt: new Date(thirdStartedAt.getTime() + thirdMetrics.durationSecondsUsed * 1000),
        durationSecondsAllocated: DURATION_SECONDS_ALLOCATED,
        durationSecondsUsed: thirdMetrics.durationSecondsUsed,
        typedTextRaw: '',
        typedTextNormalized: '',
        charCountTyped: thirdMetrics.charCountTyped,
        charCountCorrect: thirdMetrics.charCountCorrect,
        charCountError: thirdMetrics.charCountError,
        backspaceCount: thirdMetrics.backspaceCount,
        pasteCount: thirdMetrics.pasteCount,
        suspicionFlags: [...thirdMetrics.suspicionFlags, 'manual_review'],
        clientMeta: { seed: 'mock', batch: 'invalidated' },
        scoreKpm: thirdMetrics.scoreKpm,
        accuracy: thirdMetrics.accuracy,
        scoreVersion: 'seed:mock',
        createdAt: thirdStartedAt,
        updatedAt: new Date(thirdStartedAt.getTime() + thirdMetrics.durationSecondsUsed * 1000),
      });
    }
  }

  return rows;
}

async function seedMockAttempts(mockStudents: MockStudentRow[], articlePool: ArticleRow[]) {
  const attemptRows = buildAttemptRows(mockStudents, articlePool);

  for (const rowChunk of chunk(attemptRows, ATTEMPT_INSERT_CHUNK_SIZE)) {
    await db.insert(attempts).values(rowChunk);
  }

  return attemptRows.length;
}

async function main() {
  const targetCount = parseTargetCount();
  const articlePool = await getPublishedArticles();

  console.log(`Preparing mock seed for ${targetCount} students...`);
  await clearPreviousMockData();
  await seedMockStudents(targetCount);

  const mockStudents = await getMockStudents();
  const attemptCount = await seedMockAttempts(mockStudents, articlePool);

  const [studentStats, attemptStats] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(students).get(),
    db.select({ count: sql<number>`count(*)` }).from(attempts).get(),
  ]);

  console.log('Mock seed complete.');
  console.log(`- mock students inserted: ${mockStudents.length}`);
  console.log(`- mock attempts inserted: ${attemptCount}`);
  console.log(`- total students in db: ${studentStats?.count ?? 0}`);
  console.log(`- total attempts in db: ${attemptStats?.count ?? 0}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
