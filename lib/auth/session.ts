import { createHash, randomBytes } from 'node:crypto';

import { and, eq, gt } from 'drizzle-orm';
import { cookies } from 'next/headers';

import { db, ensureDatabaseReady } from '@/db/client';
import { adminUsers, sessions, students } from '@/db/schema';
import {
  ADMIN_SESSION_COOKIE,
  SESSION_DURATION_DAYS,
  STUDENT_SESSION_COOKIE,
  isDevelopment,
} from '@/lib/env';

export type SessionUserType = 'student' | 'admin';

export type AppSession = {
  id: number;
  userType: SessionUserType;
  userId: number;
  expiresAt: Date;
  tokenHash: string;
};

function getCookieName(userType: SessionUserType) {
  return userType === 'admin' ? ADMIN_SESSION_COOKIE : STUDENT_SESSION_COOKIE;
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function getSessionExpiresAt() {
  return new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
}

async function setSessionCookie(userType: SessionUserType, token: string, expiresAt: Date) {
  const cookieStore = await cookies();

  cookieStore.set(getCookieName(userType), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !isDevelopment,
    path: '/',
    expires: expiresAt,
  });
}

function isIgnorableSessionReadError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return message.includes('no such table: sessions')
    || message.includes('no such table')
    || message.includes('unable to open database file');
}

function isRetryableDatabaseLockError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes('database is locked') || message.includes('database busy');
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withDatabaseRetry<T>(label: string, action: () => Promise<T>) {
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await ensureDatabaseReady();
      return await action();
    } catch (error) {
      if (!isRetryableDatabaseLockError(error) || attempt === maxAttempts) {
        throw error;
      }

      console.warn(`[db] ${label} hit a database lock, retrying (${attempt}/${maxAttempts})`);
      await sleep(attempt * 50);
    }
  }

  throw new Error(`[db] ${label} exhausted retry attempts.`);
}

async function revokeSessionRecord(tokenHash: string) {
  await withDatabaseRetry('revokeSessionRecord', async () => {
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  });
}

export async function createSession(userType: SessionUserType, userId: number) {
  const token = randomBytes(24).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = getSessionExpiresAt();

  await withDatabaseRetry('createSession', async () => {
    await db.insert(sessions).values({
      userType,
      userId,
      tokenHash,
      expiresAt,
      metadata: {},
    });
  });

  await setSessionCookie(userType, token, expiresAt);
}

export async function clearSession(userType: SessionUserType) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getCookieName(userType))?.value;

  if (token) {
    await revokeSessionRecord(hashToken(token));
  }

  cookieStore.delete(getCookieName(userType));
}

export async function revokeSessionsForUser(userType: SessionUserType, userId: number) {
  await withDatabaseRetry('revokeSessionsForUser', async () => {
    await db
      .delete(sessions)
      .where(and(eq(sessions.userType, userType), eq(sessions.userId, userId)));
  });
}

export async function refreshSession(userType: SessionUserType) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getCookieName(userType))?.value;

  if (!token) {
    return false;
  }

  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = getSessionExpiresAt();

  const sessionRecord = await withDatabaseRetry('refreshSession', async () => (
    db.query.sessions.findFirst({
      where: and(
        eq(sessions.userType, userType),
        eq(sessions.tokenHash, tokenHash),
        gt(sessions.expiresAt, now),
      ),
    })
  ));

  if (!sessionRecord) {
    return false;
  }

  await withDatabaseRetry('refreshSessionExpiry', async () => {
    await db
      .update(sessions)
      .set({
        expiresAt,
        lastSeenAt: now,
      })
      .where(eq(sessions.id, sessionRecord.id));
  });

  await setSessionCookie(userType, token, expiresAt);
  return true;
}

async function readSessionByType(userType: SessionUserType): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getCookieName(userType))?.value;

  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);
  const now = new Date();

  try {
    const sessionRecord = await withDatabaseRetry('readSessionByType', async () => (
      db.query.sessions.findFirst({
        where: and(
          eq(sessions.userType, userType),
          eq(sessions.tokenHash, tokenHash),
          gt(sessions.expiresAt, now),
        ),
      })
    ));

    if (!sessionRecord) {
      return null;
    }

    return {
      id: sessionRecord.id,
      userType: sessionRecord.userType,
      userId: sessionRecord.userId,
      expiresAt: sessionRecord.expiresAt,
      tokenHash: sessionRecord.tokenHash,
    };
  } catch (error) {
    if (!isIgnorableSessionReadError(error)) {
      throw error;
    }

    console.error(`[auth] Failed to read ${userType} session from SQLite`, error);
    return null;
  }
}

export async function readStudentSession() {
  return readSessionByType('student');
}

export async function readAdminSession() {
  return readSessionByType('admin');
}

export async function getCurrentStudent() {
  const session = await readStudentSession();

  if (!session) {
    return null;
  }

  const student = await withDatabaseRetry('getCurrentStudent', async () => (
    db.query.students.findFirst({
      where: eq(students.id, session.userId),
    })
  ));

  if (!student) {
    await revokeSessionRecord(session.tokenHash);
    return null;
  }

  if (student.status !== 'active') {
    await revokeSessionRecord(session.tokenHash);
    return null;
  }

  return { session, student };
}

export async function getCurrentAdmin() {
  const session = await readAdminSession();

  if (!session) {
    return null;
  }

  const admin = await withDatabaseRetry('getCurrentAdmin', async () => (
    db.query.adminUsers.findFirst({
      where: eq(adminUsers.id, session.userId),
    })
  ));

  if (!admin) {
    await revokeSessionRecord(session.tokenHash);
    return null;
  }

  if (admin.status !== 'active') {
    await revokeSessionRecord(session.tokenHash);
    return null;
  }

  return { session, admin };
}
