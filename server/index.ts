import { createApp } from './app'
import { env, isProd } from './config/env'
import { pool } from './db/client'

const app = createApp()

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`PrepPilot API listening on http://localhost:${env.PORT} (${env.NODE_ENV}, AI: ${env.AI_PROVIDER})`)
  if (isProd) {
    console.warn('[email] No email provider is configured: password-reset emails are only logged, not delivered.')
  }
})

const shutdown = (signal: string) => {
  // eslint-disable-next-line no-console
  console.log(`${signal} received, shutting down...`)
  server.close(() => {
    void pool.end().finally(() => process.exit(0))
  })
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
