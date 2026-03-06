import { defineConfig } from 'drizzle-kit';

import { getDatabaseUrl } from './db/config';

export default defineConfig({
  out: './drizzle',
  schema: './db/schema/index.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: getDatabaseUrl(),
  },
  strict: true,
  verbose: true,
});
