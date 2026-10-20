import 'dotenv/config'
import { assertSafeTestDatabase } from './guard'

export default async function setup(): Promise<void> {
  assertSafeTestDatabase(process.env.TEST_DATABASE_URL)
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  const { runMigrations } = await import('../server/db/migrate')
  const { pool } = await import('../server/db/client')
  await runMigrations()
  await pool.end()
}
