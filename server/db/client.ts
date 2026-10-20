import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { env } from '../config/env'
import * as schema from './schema'

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 })

// A pool 'error' event (e.g. DB restart) must not crash the process.
pool.on('error', (err) => {
   
  console.error('[db] idle client error:', err.message)
})

export const db = drizzle(pool, { schema })
export type Db = typeof db
export { schema }
