import path from 'node:path'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db, pool } from './client'

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'server/db/migrations') })
}

// Executed directly via `npm run db:migrate`
if (process.argv[1] && /migrate\.ts$/.test(process.argv[1])) {
  runMigrations()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log('Migrations applied.')
      return pool.end()
    })
    .catch((err) => {
      console.error('Migration failed:', err)
      process.exit(1)
    })
}
