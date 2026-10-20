import request from 'supertest'
import { sql } from 'drizzle-orm'
import { createApp } from '../server/app'
import { db } from '../server/db/client'

export const app = createApp()

/** Wipes all user-owned data. `users` cascades to every student-owned table. */
export async function resetDb(): Promise<void> {
  await db.execute(sql`truncate table users restart identity cascade`)
  await db.execute(sql`delete from interview_questions where user_id is null`)
}

export const VALID_PASSWORD = 'Str0ngPassw0rd'

export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}@example.com`
}

/** Signs up a user and returns an authenticated supertest agent (cookie jar) plus the user. */
export async function signedUpAgent(overrides: { name?: string; email?: string; password?: string } = {}) {
  const agent = request.agent(app)
  const email = overrides.email ?? uniqueEmail()
  const res = await agent
    .post('/api/auth/signup')
    .send({ name: overrides.name ?? 'Test Student', email, password: overrides.password ?? VALID_PASSWORD })
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`)
  return { agent, email, user: res.body.user as { id: string; email: string; name: string; onboardingCompleted: boolean } }
}
