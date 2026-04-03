import 'server-only';

import { and, eq, gte, lt, sql } from 'drizzle-orm';

import { db, withDatabaseRetry } from '@/db/client';
import { authLoginAttempts } from '@/db/schema';

export type AuthLoginAttemptScope = 'student_login' | 'admin_login';

type LoginRateLimitConfig = {
  windowMinutes: number;
  maxFailuresPerIdentifier: number;
  maxFailuresPerIp: number;
};

type CheckLoginRateLimitInput = {
  identifier: string;
  ipAddress?: string | null;
};

type RecordLoginAttemptInput = CheckLoginRateLimitInput & {
  wasSuccessful: boolean;
};

const LOGIN_RATE_LIMIT_RETENTION_DAYS = 30;
const LOGIN_RATE_LIMIT_CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

const LOGIN_RATE_LIMITS: Record<AuthLoginAttemptScope, LoginRateLimitConfig> = {
  student_login: {
    windowMinutes: 15,
    maxFailuresPerIdentifier: 8,
    maxFailuresPerIp: 30,
  },
  admin_login: {
    windowMinutes: 15,
    maxFailuresPerIdentifier: 6,
    maxFailuresPerIp: 20,
  },
};

let lastLoginAttemptCleanupAt = 0;

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

async function cleanupExpiredLoginAttempts() {
  const now = Date.now();

  if (now - lastLoginAttemptCleanupAt < LOGIN_RATE_LIMIT_CLEANUP_INTERVAL_MS) {
    return;
  }

  const retentionStart = new Date(Date.now() - LOGIN_RATE_LIMIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  await withDatabaseRetry('cleanupExpiredLoginAttempts', async () => {
    await db
      .delete(authLoginAttempts)
      .where(lt(authLoginAttempts.createdAt, retentionStart));
  });

  lastLoginAttemptCleanupAt = now;
}

async function countRecentFailures(
  scope: AuthLoginAttemptScope,
  conditions: {
    identifier?: string;
    ipAddress?: string | null;
  },
) {
  const config = LOGIN_RATE_LIMITS[scope];
  const windowStart = new Date(Date.now() - config.windowMinutes * 60 * 1000);
  const whereConditions = [
    eq(authLoginAttempts.scope, scope),
    eq(authLoginAttempts.wasSuccessful, false),
    gte(authLoginAttempts.createdAt, windowStart),
  ];

  if (conditions.identifier) {
    whereConditions.push(eq(authLoginAttempts.identifier, normalizeIdentifier(conditions.identifier)));
  }

  if (conditions.ipAddress) {
    whereConditions.push(eq(authLoginAttempts.ipAddress, conditions.ipAddress));
  }

  const [result] = await withDatabaseRetry('countRecentFailures', async () => (
    db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(authLoginAttempts)
      .where(and(...whereConditions))
  ));

  return result?.count ?? 0;
}

export async function checkLoginRateLimit(
  scope: AuthLoginAttemptScope,
  input: CheckLoginRateLimitInput,
) {
  const config = LOGIN_RATE_LIMITS[scope];
  const identifier = normalizeIdentifier(input.identifier);
  const [identifierFailures, ipFailures] = await Promise.all([
    countRecentFailures(scope, { identifier }),
    input.ipAddress ? countRecentFailures(scope, { ipAddress: input.ipAddress }) : Promise.resolve(0),
  ]);

  if (
    identifierFailures >= config.maxFailuresPerIdentifier
    || ipFailures >= config.maxFailuresPerIp
  ) {
    return {
      blocked: true,
      message: `登录尝试过于频繁，请在 ${config.windowMinutes} 分钟后再试。`,
    };
  }

  return {
    blocked: false,
    message: null,
  };
}

export async function recordLoginAttempt(
  scope: AuthLoginAttemptScope,
  input: RecordLoginAttemptInput,
) {
  await cleanupExpiredLoginAttempts();

  await withDatabaseRetry('recordLoginAttempt', async () => {
    await db.insert(authLoginAttempts).values({
      scope,
      identifier: normalizeIdentifier(input.identifier),
      ipAddress: input.ipAddress ?? null,
      wasSuccessful: input.wasSuccessful,
    });
  });
}
