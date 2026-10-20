import { eq } from 'drizzle-orm'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../server/db/client'
import { passwordResetTokens, sessions, users } from '../server/db/schema'
import { app, resetDb, signedUpAgent, uniqueEmail, VALID_PASSWORD } from './helpers'

beforeEach(resetDb)

describe('signup', () => {
  it('creates an account, sets an httpOnly session cookie, and never returns the password hash', async () => {
    const email = uniqueEmail()
    const res = await request(app).post('/api/auth/signup').send({ name: 'Alex', email, password: VALID_PASSWORD })
    expect(res.status).toBe(201)
    expect(res.body.user).toMatchObject({ email, name: 'Alex', onboardingCompleted: false })
    expect(JSON.stringify(res.body)).not.toMatch(/hash|password/i)
    const cookie = (res.headers['set-cookie'] as unknown as string[]).join(';')
    expect(cookie).toMatch(/pp_session=/)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
  })

  it('stores a hashed password, never plaintext', async () => {
    const { email } = await signedUpAgent()
    const [row] = await db.select().from(users).where(eq(users.email, email))
    expect(row?.passwordHash).toBeTruthy()
    expect(row?.passwordHash).not.toContain(VALID_PASSWORD)
    expect(row?.passwordHash).toMatch(/^\$2[aby]\$/)
  })

  it('stores only a hash of the session token', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Alex', email: uniqueEmail(), password: VALID_PASSWORD })
    const raw = /pp_session=([^;]+)/.exec((res.headers['set-cookie'] as unknown as string[]).join(';'))?.[1]
    const rows = await db.select().from(sessions)
    expect(rows).toHaveLength(1)
    expect(raw).toBeTruthy()
    expect(rows[0]?.tokenHash).not.toBe(raw)
  })

  it('normalises email case and rejects duplicates case-insensitively', async () => {
    await signedUpAgent({ email: 'Mixed.Case@Example.com' })
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Other', email: 'mixed.case@example.com', password: VALID_PASSWORD })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('EMAIL_TAKEN')
  })

  it.each([
    ['too short', 'Ab1'],
    ['no number', 'OnlyLettersHere'],
    ['no letter', '1234567890'],
  ])('rejects a weak password (%s) with a field error', async (_label, password) => {
    const res = await request(app).post('/api/auth/signup').send({ name: 'A', email: uniqueEmail(), password })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.fieldErrors.password).toBeTruthy()
  })

  it('rejects missing name and invalid email', async () => {
    const res = await request(app).post('/api/auth/signup').send({ name: '  ', email: 'nope', password: VALID_PASSWORD })
    expect(res.status).toBe(400)
    expect(res.body.error.fieldErrors.name).toBeTruthy()
    expect(res.body.error.fieldErrors.email).toBeTruthy()
  })

  it('returns a safe 400 for malformed JSON (no stack trace)', async () => {
    const res = await request(app).post('/api/auth/signup').set('Content-Type', 'application/json').send('{bad json')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_JSON')
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\(.*\)|node_modules/)
  })
})

describe('login / session', () => {
  it('logs in with correct credentials and can read /me', async () => {
    const { email } = await signedUpAgent({ name: 'Sam' })
    const agent = request.agent(app)
    const login = await agent.post('/api/auth/login').send({ email: email.toUpperCase(), password: VALID_PASSWORD })
    expect(login.status).toBe(200)
    const me = await agent.get('/api/auth/me')
    expect(me.status).toBe(200)
    expect(me.body.user.name).toBe('Sam')
  })

  it('gives the same generic error for wrong password and unknown email', async () => {
    const { email } = await signedUpAgent()
    const wrong = await request(app).post('/api/auth/login').send({ email, password: 'WrongPass123' })
    const unknown = await request(app).post('/api/auth/login').send({ email: uniqueEmail(), password: 'WrongPass123' })
    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(wrong.body).toEqual(unknown.body)
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('rejects /me without a session', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('rejects a forged session cookie', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'pp_session=totally-made-up-token')
    expect(res.status).toBe(401)
  })

  it('logout invalidates the session server-side', async () => {
    const { agent } = await signedUpAgent()
    expect((await agent.get('/api/auth/me')).status).toBe(200)
    expect((await agent.post('/api/auth/logout')).status).toBe(204)
    expect((await agent.get('/api/auth/me')).status).toBe(401)
    expect(await db.select().from(sessions)).toHaveLength(0)
  })

  it('rejects an expired session with SESSION_EXPIRED and removes it', async () => {
    const { agent } = await signedUpAgent()
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) })
    const res = await agent.get('/api/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('SESSION_EXPIRED')
    expect(await db.select().from(sessions)).toHaveLength(0)
  })

  it('never tells a visitor who was never signed in that their session "expired"', async () => {
    // A brand-new visitor (no cookie at all) hitting a protected route should get a plain "please sign in"
    // response, not the "your session has expired" message — that phrasing only makes sense once you've had one.
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHENTICATED')
    expect(res.body.error.message.toLowerCase()).not.toContain('expired')
  })

  it('blocks state-changing requests from a foreign Origin', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'a@b.co', password: 'x' })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN_ORIGIN')
  })
})

describe('password reset', () => {
  it('does not reveal whether an email exists', async () => {
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: uniqueEmail() })
    expect(unknown.status).toBe(200)
    expect(unknown.body.devResetUrl).toBeUndefined()
    const { email } = await signedUpAgent()
    const known = await request(app).post('/api/auth/forgot-password').send({ email })
    expect(known.status).toBe(200)
    expect(known.body.message).toBe(unknown.body.message)
  })

  async function requestToken(email: string): Promise<string> {
    const res = await request(app).post('/api/auth/forgot-password').send({ email })
    const token = new URL(res.body.devResetUrl as string).searchParams.get('token')
    if (!token) throw new Error('no token')
    return token
  }

  it('resets the password once, revokes all sessions, and the old password stops working', async () => {
    const { email, agent } = await signedUpAgent()
    const token = await requestToken(email)
    const newPassword = 'BrandNewPass99'

    const ok = await request(app).post('/api/auth/reset-password').send({ token, password: newPassword })
    expect(ok.status).toBe(200)

    expect((await agent.get('/api/auth/me')).status).toBe(401) // old session revoked
    expect((await request(app).post('/api/auth/login').send({ email, password: VALID_PASSWORD })).status).toBe(401)
    expect((await request(app).post('/api/auth/login').send({ email, password: newPassword })).status).toBe(200)

    const reuse = await request(app).post('/api/auth/reset-password').send({ token, password: 'AnotherPass123' })
    expect(reuse.status).toBe(400)
    expect(reuse.body.error.code).toBe('INVALID_RESET_TOKEN')
  })

  it('rejects an expired token', async () => {
    const { email } = await signedUpAgent()
    const token = await requestToken(email)
    await db.update(passwordResetTokens).set({ expiresAt: new Date(Date.now() - 1000) })
    const res = await request(app).post('/api/auth/reset-password').send({ token, password: 'BrandNewPass99' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_RESET_TOKEN')
  })

  it('rejects a weak new password and a made-up token', async () => {
    const weak = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'x'.repeat(40), password: 'short' })
    expect(weak.status).toBe(400)
    const fake = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'x'.repeat(40), password: 'BrandNewPass99' })
    expect(fake.status).toBe(400)
    expect(fake.body.error.code).toBe('INVALID_RESET_TOKEN')
  })

  it('only the newest reset link works', async () => {
    const { email } = await signedUpAgent()
    const first = await requestToken(email)
    const second = await requestToken(email)
    const a = await request(app).post('/api/auth/reset-password').send({ token: first, password: 'BrandNewPass99' })
    expect(a.status).toBe(400)
    const b = await request(app).post('/api/auth/reset-password').send({ token: second, password: 'BrandNewPass99' })
    expect(b.status).toBe(200)
  })
})

describe('API surface', () => {
  it('health check reports the database', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok', database: 'up' })
  })

  it('unknown /api paths require auth (no information leak), then 404 when signed in', async () => {
    expect((await request(app).get('/api/nope')).status).toBe(401)
    const { agent } = await signedUpAgent()
    expect((await agent.get('/api/nope')).status).toBe(404)
  })
})
