import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  APP_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
  AI_PROVIDER: z.enum(['mock', 'anthropic', 'openai']).default('mock'),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
})

export type Env = z.infer<typeof schema>

/** Parses and validates environment variables, exiting with a readable message on failure. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = schema.safeParse(source)
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.') || 'env'}: ${i.message}`)
     
    console.error(
      [
        '',
        'PrepPilot cannot start: invalid or missing environment configuration.',
        ...lines,
        '',
        'Copy .env.example to .env and fill in the values (see README, "Environment variables").',
        '',
      ].join('\n'),
    )
    process.exit(1)
  }
  return result.data
}

export const env = loadEnv()
export const isProd = env.NODE_ENV === 'production'
