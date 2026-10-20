import type { CookieOptions, Request, RequestHandler, Response } from 'express'
import type { AuthUser } from '../../shared/validation'
import { env, isProd } from '../config/env'
import { getUserForSession } from '../services/authService'
import { unauthorized } from '../utils/errors'

export const SESSION_COOKIE = 'pp_session'

const baseCookie: CookieOptions = {
  httpOnly: true, // not readable from JavaScript (mitigates XSS token theft)
  sameSite: 'lax', // not sent on cross-site POSTs (CSRF defence, with the origin check)
  secure: isProd,
  path: '/',
}

export const setSessionCookie = (res: Response, token: string, expiresAt: Date): void => {
  res.cookie(SESSION_COOKIE, token, { ...baseCookie, expires: expiresAt })
}
export const clearSessionCookie = (res: Response): void => {
  res.clearCookie(SESSION_COOKIE, baseCookie)
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by `requireAuth`. Always derive ownership from this, never from client-sent ids. */
    user?: AuthUser
  }
}

/** Requires a valid session; attaches `req.user`. Distinguishes "never signed in" (no cookie at all) from
 *  "had a session that is no longer valid" (cookie present but expired/revoked) so the client only shows
 *  a "your session expired" message in the latter case — a first-time visitor should never see that toast. */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined
  if (!token) throw unauthorized('Please sign in to continue.', 'UNAUTHENTICATED')
  const user = await getUserForSession(token)
  if (!user) {
    clearSessionCookie(res)
    throw unauthorized('Your session has expired. Please sign in again.', 'SESSION_EXPIRED')
  }
  req.user = user
  next()
}

/** Typed accessor for handlers mounted behind `requireAuth`. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized()
  return req.user
}

function isAllowedOrigin(origin: string, host: string | undefined): boolean {
  try {
    const originUrl = new URL(origin)
    return originUrl.origin === new URL(env.APP_URL).origin || originUrl.host === host
  } catch {
    return false // unparseable Origin header
  }
}

/**
 * CSRF hardening for cookie auth: state-changing requests that carry an Origin header
 * must come from our own app. (SameSite=Lax already blocks cross-site cookie sending.)
 */
export const originCheck: RequestHandler = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const origin = req.get('origin')
  if (!origin) return next() // non-browser clients (curl, tests) don't send Origin
  if (!isAllowedOrigin(origin, req.get('host'))) {
    res.status(403).json({ error: { code: 'FORBIDDEN_ORIGIN', message: 'Request origin is not allowed.' } })
    return
  }
  next()
}
