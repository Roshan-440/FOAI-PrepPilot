import { and, eq, gt, isNull } from 'drizzle-orm'
import type { AuthUser, LoginInput, SignupInput } from '../../shared/validation'
import { env } from '../config/env'
import { db } from '../db/client'
import { passwordResetTokens, profiles, sessions, users } from '../db/schema'
import { AppError, badRequest, conflict, pgErrorCode, unauthorized } from '../utils/errors'
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../utils/password'
import { generateToken, hashToken } from '../utils/tokens'
import { emailDeliveryIsSimulated, getEmailService } from './emailService'

const DAY_MS = 24 * 60 * 60 * 1000
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour
const PG_UNIQUE_VIOLATION = '23505'

export interface SessionResult {
  user: AuthUser
  token: string
  expiresAt: Date
}

async function toAuthUser(row: { id: string; email: string; name: string }): Promise<AuthUser> {
  const [profile] = await db
    .select({ onboardingCompleted: profiles.onboardingCompleted })
    .from(profiles)
    .where(eq(profiles.userId, row.id))
  return { id: row.id, email: row.email, name: row.name, onboardingCompleted: profile?.onboardingCompleted ?? false }
}

async function createSession(userId: string, userAgent?: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * DAY_MS)
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
    userAgent: userAgent?.slice(0, 300) ?? null,
  })
  return { token, expiresAt }
}

export async function signup(input: SignupInput, userAgent?: string): Promise<SessionResult> {
  const passwordHash = await hashPassword(input.password)
  let created: { id: string; email: string; name: string }
  try {
    created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(users)
        .values({ email: input.email, name: input.name, passwordHash })
        .returning({ id: users.id, email: users.email, name: users.name })
      if (!row) throw new AppError(500, 'INTERNAL', 'Could not create account.')
      await tx.insert(profiles).values({ userId: row.id })
      return row
    })
  } catch (err) {
    // The unique index is the source of truth; this is race-safe unlike a pre-check.
    if (pgErrorCode(err) === PG_UNIQUE_VIOLATION) {
      throw conflict('An account with this email already exists. Try signing in instead.', 'EMAIL_TAKEN', {
        email: 'An account with this email already exists.',
      })
    }
    throw err
  }
  const session = await createSession(created.id, userAgent)
  return { user: await toAuthUser(created), ...session }
}

export async function login(input: LoginInput, userAgent?: string): Promise<SessionResult> {
  const [row] = await db.select().from(users).where(eq(users.email, input.email))
  if (!row) {
    await verifyAgainstDummy(input.password)
    throw unauthorized('Incorrect email or password.', 'INVALID_CREDENTIALS')
  }
  const ok = await verifyPassword(input.password, row.passwordHash)
  if (!ok) throw unauthorized('Incorrect email or password.', 'INVALID_CREDENTIALS')
  const session = await createSession(row.id, userAgent)
  return { user: await toAuthUser(row), ...session }
}

/** Resolves a raw session token to its user, or null when missing/expired. */
export async function getUserForSession(token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null
  const tokenHash = hashToken(token)
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, tokenHash))
  if (!row) return null
  if (row.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash))
    return null
  }
  return toAuthUser(row)
}

export async function logout(token: string | undefined): Promise<void> {
  if (!token) return
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)))
}

export interface PasswordResetRequestResult {
  /** Present only when email delivery is simulated (development/test). Never in production. */
  devResetUrl?: string
}

/**
 * Always resolves successfully so callers cannot learn whether an email is registered.
 */
export async function requestPasswordReset(email: string): Promise<PasswordResetRequestResult> {
  const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, email))
  if (!user) return {}

  // Invalidate any earlier unused tokens so only the newest link works.
  await db
    .delete(passwordResetTokens)
    .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)))

  const token = generateToken()
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  })

  const resetUrl = `${env.APP_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`
  await getEmailService().sendPasswordReset(user.email, resetUrl)
  return emailDeliveryIsSimulated() ? { devResetUrl: resetUrl } : {}
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(token)
  const passwordHash = await hashPassword(newPassword)

  await db.transaction(async (tx) => {
    // Atomically claim the token: a second concurrent use matches zero rows.
    const [claimed] = await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
      .returning({ userId: passwordResetTokens.userId })
    if (!claimed) {
      throw badRequest('This reset link is invalid or has expired. Please request a new one.', 'INVALID_RESET_TOKEN')
    }
    await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, claimed.userId))
    // Sign out everywhere: a reset implies the old credentials may be compromised.
    await tx.delete(sessions).where(eq(sessions.userId, claimed.userId))
  })
}
