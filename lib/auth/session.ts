import { createHash, randomBytes } from 'node:crypto';

import { and, eq, gt } from 'drizzle-orm';
import { cookies } from 'next/headers';

import { db } from '@/db/client';
import { adminUsers, sessions, students } from '@/db/schema';
import {
  ADMIN_SESSION_COOKIE,
  SESSION_DURATION_HOURS,
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

export async function createSession(userType: SessionUserType, userId: number) {
  const token = randomBytes(24).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

  await db.insert(sessions).values({
    userType,
    userId,
    tokenHash,
    expiresAt,
    metadata: {},
  });

  const cookieStore = await cookies();
  cookieStore.set(getCookieName(userType), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !isDevelopment,
    path: '/',
    expires: expiresAt,
  });
}

export async function clearSession(userType: SessionUserType) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getCookieName(userType))?.value;

  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }

  cookieStore.delete(getCookieName(userType));
}

async function readSessionByType(userType: SessionUserType): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getCookieName(userType))?.value;

  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);
  const now = new Date();
  const sessionRecord = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.userType, userType),
      eq(sessions.tokenHash, tokenHash),
      gt(sessions.expiresAt, now),
    ),
  });

  if (!sessionRecord) {
    cookieStore.delete(getCookieName(userType));
    return null;
  }

  return {
    id: sessionRecord.id,
    userType: sessionRecord.userType,
    userId: sessionRecord.userId,
    expiresAt: sessionRecord.expiresAt,
    tokenHash: sessionRecord.tokenHash,
  };
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

  const student = await db.query.students.findFirst({
    where: eq(students.id, session.userId),
  });

  if (!student) {
    await clearSession('student');
    return null;
  }

  return { session, student };
}

export async function getCurrentAdmin() {
  const session = await readAdminSession();

  if (!session) {
    return null;
  }

  const admin = await db.query.adminUsers.findFirst({
    where: eq(adminUsers.id, session.userId),
  });

  if (!admin) {
    await clearSession('admin');
    return null;
  }

  return { session, admin };
}
