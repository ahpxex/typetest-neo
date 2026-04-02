import { createClient } from '@libsql/client'

import { ensureDatabaseDirectory, getDatabaseUrl } from '@/db/config'

async function configureSqlite() {
  const databaseUrl = getDatabaseUrl()

  if (!databaseUrl.startsWith('file:')) {
    console.log('Skipping SQLite file configuration: non-file database URL detected.')
    return
  }

  ensureDatabaseDirectory()

  const client = createClient({ url: databaseUrl })

  try {
    await client.execute('PRAGMA journal_mode = WAL')
    await client.execute('PRAGMA synchronous = NORMAL')
    await client.execute('PRAGMA foreign_keys = ON')
    await client.execute('PRAGMA busy_timeout = 5000')
    console.log(`Configured SQLite pragmas for ${databaseUrl}.`)
  } finally {
    client.close()
  }
}

configureSqlite().catch((error) => {
  console.error(error)
  process.exit(1)
})
