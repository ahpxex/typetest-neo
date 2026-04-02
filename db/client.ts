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
      await client.execute('PRAGMA busy_timeout = 5000');
      await client.execute('PRAGMA synchronous = NORMAL');
      await client.execute('PRAGMA foreign_keys = ON');
    })()
  : Promise.resolve();

export const db = drizzle(client, { schema });

export async function ensureDatabaseReady() {
  await databaseReadyPromise;
}

export { client };
