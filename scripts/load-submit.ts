import { createHash, randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import { createClient } from '@libsql/client';

type StudentRow = {
  id: number;
  student_no: string;
  name: string;
  campus_email: string;
};

type ArticleRow = {
  id: number;
  title: string;
  content_raw: string;
};

type AttemptSeed = {
  attemptId: number;
  studentId: number;
  studentNo: string;
  token: string;
  articleTitle: string;
  contentRaw: string;
};

function getArg(name: string, fallback?: string) {
  const prefix = `--${name}=`;
  const value = Bun.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function percentile(sortedValues: number[], ratio: number) {
  if (sortedValues.length === 0) {
    return 0;
  }

  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * ratio) - 1));
  return sortedValues[index] ?? 0;
}

function buildSyntheticStudentNo(index: number) {
  const enrollmentYear = '2099';
  const majorCode = String(90000 + index).slice(-5);
  const classSerial = String(index % 100).padStart(2, '0');
  return `${enrollmentYear}${majorCode}${classSerial}`;
}

async function ensureEnoughStudents(client: ReturnType<typeof createClient>, students: StudentRow[], targetCount: number) {
  if (students.length >= targetCount) {
    return students;
  }

  const now = Date.now();
  const missingCount = targetCount - students.length;

  for (let index = 1; index <= missingCount; index += 1) {
    const studentNo = buildSyntheticStudentNo(index);
    const name = `压测学生${String(index).padStart(4, '0')}`;
    const campusEmail = `${studentNo}@ucass.edu.cn`;

    await client.execute({
      sql: `INSERT INTO students (
        student_no, name, campus_email, enrollment_year, school_code, major_code, class_serial,
        status, email_verified_at, last_login_at, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        studentNo,
        name,
        campusEmail,
        studentNo.slice(0, 4),
        studentNo.slice(4, 7),
        studentNo.slice(4, 9),
        studentNo.slice(9, 11),
        'active',
        null,
        null,
        'load-test',
        now,
        now,
      ],
    });
  }

  const refetch = await client.execute({
    sql: `SELECT id, student_no, name, campus_email
      FROM students
      WHERE status = 'active'
      ORDER BY id ASC
      LIMIT ?`,
    args: [targetCount],
  });

  return refetch.rows as unknown as StudentRow[];
}

async function prepareAttempts(dbUrl: string, concurrency: number) {
  const client = createClient({ url: dbUrl });

  await client.execute('PRAGMA journal_mode = WAL');
  await client.execute('PRAGMA busy_timeout = 5000');
  await client.execute('PRAGMA synchronous = NORMAL');

  const articleResult = await client.execute({
    sql: `SELECT id, title, content_raw
      FROM articles
      WHERE status = 'published'
      ORDER BY id ASC
      LIMIT 1`,
  });
  const article = articleResult.rows[0] as unknown as ArticleRow | undefined;

  if (!article) {
    throw new Error('No published article found in test database.');
  }

  const studentResult = await client.execute({
    sql: `SELECT id, student_no, name, campus_email
      FROM students
      WHERE status = 'active'
      ORDER BY id ASC
      LIMIT ?`,
    args: [concurrency],
  });
  const students = await ensureEnoughStudents(client, studentResult.rows as unknown as StudentRow[], concurrency);

  if (students.length < concurrency) {
    throw new Error(`Expected at least ${concurrency} active students, found ${students.length}.`);
  }

  const studentIds = students.map((student) => student.id);
  const placeholders = studentIds.map(() => '?').join(', ');
  const maxAttemptResult = await client.execute({
    sql: `SELECT student_id, MAX(attempt_no) AS max_attempt_no
      FROM attempts
      WHERE student_id IN (${placeholders})
      GROUP BY student_id`,
    args: studentIds,
  });

  const maxAttemptMap = new Map<number, number>();
  for (const row of maxAttemptResult.rows as unknown as Array<{ student_id: number; max_attempt_no: number | null }>) {
    maxAttemptMap.set(Number(row.student_id), Number(row.max_attempt_no ?? 0));
  }

  const now = Date.now();
  const attempts: AttemptSeed[] = [];

  for (const student of students) {
    const attemptNo = (maxAttemptMap.get(student.id) ?? 0) + 1;
    const token = randomBytes(24).toString('hex');
    const tokenHash = hashToken(token);
    const startedAt = now - 90_000;
    const expiresAt = now + 60 * 60 * 1000;

    await client.execute({
      sql: `INSERT INTO sessions (
        user_type, user_id, token_hash, expires_at, last_seen_at, ip_address, user_agent, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'student',
        student.id,
        tokenHash,
        expiresAt,
        now,
        '127.0.0.1',
        'load-test-script',
        JSON.stringify({ source: 'load-submit-script' }),
        now,
      ],
    });

    await client.execute({
      sql: `INSERT INTO attempts (
        student_id, article_id, mode, attempt_no, status, student_no_snapshot, student_name_snapshot,
        campus_email_snapshot, article_title_snapshot, started_at, submitted_at, duration_seconds_allocated,
        duration_seconds_used, typed_text_raw, typed_text_normalized, char_count_typed, char_count_correct,
        char_count_error, backspace_count, suspicion_flags, client_meta, score_kpm, accuracy, score_version,
        ip_address, user_agent, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id`,
      args: [
        student.id,
        article.id,
        'exam',
        attemptNo,
        'started',
        student.student_no,
        student.name,
        student.campus_email,
        article.title,
        startedAt,
        null,
        180,
        null,
        '',
        '',
        0,
        0,
        0,
        0,
        JSON.stringify([]),
        JSON.stringify({ source: 'load-submit-script' }),
        0,
        0,
        'v2',
        '127.0.0.1',
        'load-test-script',
        startedAt,
        startedAt,
      ],
    });

    const attemptIdResult = await client.execute({
      sql: `SELECT id
        FROM attempts
        WHERE student_id = ? AND attempt_no = ?
        ORDER BY id DESC
        LIMIT 1`,
      args: [student.id, attemptNo],
    });
    const attemptId = Number(attemptIdResult.rows[0]?.id ?? 0);

    if (!attemptId) {
      throw new Error(`Failed to create attempt for student ${student.student_no}.`);
    }

    attempts.push({
      attemptId,
      studentId: student.id,
      studentNo: student.student_no,
      token,
      articleTitle: article.title,
      contentRaw: article.content_raw,
    });
  }

  return { client, attempts, articleTitle: article.title };
}

async function run() {
  const concurrency = Number.parseInt(getArg('concurrency', '1000') ?? '1000', 10);
  const baseUrl = getArg('base-url', 'http://127.0.0.1:3025') ?? 'http://127.0.0.1:3025';
  const dbUrl = getArg('db-url', process.env.DATABASE_URL);
  const cookieName = getArg('cookie-name', 'typetest_student_session') ?? 'typetest_student_session';

  if (!dbUrl) {
    throw new Error('Missing --db-url or DATABASE_URL.');
  }

  console.log(`Preparing ${concurrency} concurrent submissions against ${baseUrl}`);
  const { client, attempts, articleTitle } = await prepareAttempts(dbUrl, concurrency);
  console.log(`Prepared ${attempts.length} started attempts for article: ${articleTitle}`);

  await fetch(baseUrl, { redirect: 'manual' }).catch(() => undefined);

  const startedAt = performance.now();
  const results = await Promise.all(
    attempts.map(async (attempt) => {
      const requestStartedAt = performance.now();
      try {
        const response = await fetch(`${baseUrl}/api/attempts/${attempt.attemptId}/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `${cookieName}=${attempt.token}`,
            Origin: baseUrl,
            Referer: `${baseUrl}/typing/exam`,
          },
          body: JSON.stringify({
            typedTextRaw: attempt.contentRaw,
            backspaceCount: 0,
            clientMeta: {
              source: 'load-submit-script',
            },
          }),
        });
        const elapsed = performance.now() - requestStartedAt;
        const payload = await response.text();

        return {
          ok: response.ok,
          status: response.status,
          elapsed,
          payload,
          attemptId: attempt.attemptId,
          studentNo: attempt.studentNo,
        };
      } catch (error) {
        const elapsed = performance.now() - requestStartedAt;
        return {
          ok: false,
          status: 0,
          elapsed,
          payload: error instanceof Error ? error.message : String(error),
          attemptId: attempt.attemptId,
          studentNo: attempt.studentNo,
        };
      }
    }),
  );
  const totalElapsed = performance.now() - startedAt;

  const submittedCountResult = await client.execute({
    sql: `SELECT COUNT(*) AS count FROM attempts WHERE id IN (${attempts.map(() => '?').join(', ')}) AND status = 'submitted'`,
    args: attempts.map((attempt) => attempt.attemptId),
  });
  const submittedCount = Number(submittedCountResult.rows[0]?.count ?? 0);

  const latencies = results.map((result) => result.elapsed).sort((left, right) => left - right);
  const successCount = results.filter((result) => result.ok).length;
  const failureResults = results.filter((result) => !result.ok);

  console.log('');
  console.log('Load test summary');
  console.log(`- concurrency: ${concurrency}`);
  console.log(`- total time: ${totalElapsed.toFixed(1)} ms`);
  console.log(`- successes: ${successCount}`);
  console.log(`- failures: ${failureResults.length}`);
  console.log(`- submitted rows: ${submittedCount}`);
  console.log(`- p50: ${percentile(latencies, 0.5).toFixed(1)} ms`);
  console.log(`- p90: ${percentile(latencies, 0.9).toFixed(1)} ms`);
  console.log(`- p99: ${percentile(latencies, 0.99).toFixed(1)} ms`);
  console.log(`- max: ${latencies.at(-1)?.toFixed(1) ?? '0.0'} ms`);

  if (failureResults.length > 0) {
    console.log('');
    console.log('Sample failures');
    for (const result of failureResults.slice(0, 10)) {
      console.log(`- attempt=${result.attemptId} student=${result.studentNo} status=${result.status} elapsed=${result.elapsed.toFixed(1)}ms payload=${result.payload.slice(0, 160)}`);
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
