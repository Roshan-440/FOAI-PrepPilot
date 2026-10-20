import { Router } from 'express'
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from '../../shared/validation'
import {
  SESSION_COOKIE,
  clearSessionCookie,
  requireAuth,
  currentUser,
  setSessionCookie,
} from '../middleware/auth'
import { authLimiter } from '../middleware/rateLimit'
import * as authService from '../services/authService'

export const authRouter = Router()

authRouter.post('/signup', authLimiter, async (req, res) => {
  const input = signupSchema.parse(req.body)
  const { user, token, expiresAt } = await authService.signup(input, req.get('user-agent'))
  setSessionCookie(res, token, expiresAt)
  res.status(201).json({ user })
})

authRouter.post('/login', authLimiter, async (req, res) => {
  const input = loginSchema.parse(req.body)
  const { user, token, expiresAt } = await authService.login(input, req.get('user-agent'))
  setSessionCookie(res, token, expiresAt)
  res.json({ user })
})

authRouter.post('/logout', async (req, res) => {
  await authService.logout(req.cookies?.[SESSION_COOKIE] as string | undefined)
  clearSessionCookie(res)
  res.status(204).end()
})

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: currentUser(req) })
})

authRouter.post('/forgot-password', authLimiter, async (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body)
  const result = await authService.requestPasswordReset(email)
  // Same message regardless of whether the account exists.
  res.json({
    message: 'If an account exists for that email, a password reset link has been sent.',
    ...result,
  })
})

authRouter.post('/reset-password', authLimiter, async (req, res) => {
  const { token, password } = resetPasswordSchema.parse(req.body)
  await authService.resetPassword(token, password)
  clearSessionCookie(res)
  res.json({ message: 'Your password has been reset. You can now sign in.' })
})
