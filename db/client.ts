import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import { ensureDatabaseDirectory, getDatabaseUrl } from '@/db/config';
import * as schema from '@/db/schema';

ensureDatabaseDirectory();

const client = createClient({
  url: getDatabaseUrl(),
});

export const db = drizzle(client, { schema });
export { client };
