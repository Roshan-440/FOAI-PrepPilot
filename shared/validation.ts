import { z } from 'zod'

/** Password policy shared by the client (for live hints) and server (authoritative). */
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 72 // bcrypt only uses the first 72 bytes
export const PASSWORD_HINT = `At least ${PASSWORD_MIN} characters, including a letter and a number.`

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters.`)
  .max(PASSWORD_MAX, `Password must be at most ${PASSWORD_MAX} characters.`)
  .refine((v) => /[A-Za-z]/.test(v), 'Password must include at least one letter.')
  .refine((v) => /\d/.test(v), 'Password must include at least one number.')

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long.')
  .pipe(z.email('Enter a valid email address.'))

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required.')
  .max(80, 'Name must be at most 80 characters.')

export const signupSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
})

export const loginSchema = z.object({
  email: emailSchema,
  // Do not apply the strength policy at login: older accounts must still be able to sign in.
  password: z.string().min(1, 'Password is required.').max(200),
})

export const forgotPasswordSchema = z.object({ email: emailSchema })

export const resetPasswordSchema = z.object({
  token: z.string().min(20, 'Reset link is invalid.').max(200),
  password: passwordSchema,
})

export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>

export interface AuthUser {
  id: string
  email: string
  name: string
  onboardingCompleted: boolean
}

export interface ApiErrorBody {
  error: { code: string; message: string; fieldErrors?: Record<string, string> }
}
