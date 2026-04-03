import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import { ensureDatabaseDirectory, getDatabaseUrl } from '@/db/config';
import * as schema from '@/db/schema';

ensureDatabaseDirectory();

const databaseUrl = getDatabaseUrl();

const client = createClient({
  url: databaseUrl,
});

const databaseReadyPromise = databaseUrl.startsWith('file:')
  ? (async () => {
      await client.execute('PRAGMA journal_mode = WAL');
      await client.execute('PRAGMA busy_timeout = 5000');
      await client.execute('PRAGMA synchronous = NORMAL');
      await client.execute('PRAGMA foreign_keys = ON');
    })()
  : Promise.resolve();

export const db = drizzle(client, { schema });

export async function ensureDatabaseReady() {
  await databaseReadyPromise;
}

export function isRetryableDatabaseLockError(error: unknown) {
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

export async function withDatabaseRetry<T>(
  label: string,
  action: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    baseDelayMs?: number;
  },
) {
  const maxAttempts = options?.maxAttempts ?? 4;
  const baseDelayMs = options?.baseDelayMs ?? 50;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await ensureDatabaseReady();
      return await action();
    } catch (error) {
      if (!isRetryableDatabaseLockError(error) || attempt === maxAttempts) {
        throw error;
      }

      console.warn(`[db] ${label} hit a database lock, retrying (${attempt}/${maxAttempts})`);
      await sleep(baseDelayMs * attempt);
    }
  }

  throw new Error(`[db] ${label} exhausted retry attempts.`);
}

export { client };
