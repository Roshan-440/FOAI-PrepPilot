import { rateLimit } from 'express-rate-limit'

const isTest = process.env.NODE_ENV === 'test'

const limiter = (windowMs: number, limit: number, message: string) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => isTest,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: 'RATE_LIMITED', message } })
    },
  })

/** Brute-force protection for credential endpoints. */
export const authLimiter = limiter(15 * 60 * 1000, 30, 'Too many attempts. Please wait a few minutes and try again.')
/** Expensive AI endpoints (used from Phase 4/5 onward). */
export const aiLimiter = limiter(60 * 1000, 20, 'You are sending requests too quickly. Please slow down.')
