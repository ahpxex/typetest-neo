import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const DEFAULT_SQLITE_PATH = join(process.cwd(), 'data', 'app.sqlite');

function normalizeDatabaseUrl(databaseUrl?: string) {
  if (!databaseUrl) {
    return DEFAULT_SQLITE_PATH;
  }

  if (databaseUrl.startsWith('file:')) {
    return databaseUrl.slice('file:'.length);
  }

  return databaseUrl;
}

export function getDatabaseFilePath() {
  return normalizeDatabaseUrl(process.env.DATABASE_URL);
}

export function getDatabaseUrl() {
  const databaseFilePath = getDatabaseFilePath();

  return databaseFilePath.startsWith('file:')
    ? databaseFilePath
    : `file:${databaseFilePath}`;
}

export function ensureDatabaseDirectory() {
  mkdirSync(dirname(getDatabaseFilePath()), { recursive: true });
}
