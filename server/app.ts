import fs from 'node:fs'
import path from 'node:path'
import cookieParser from 'cookie-parser'
import express, { type Express } from 'express'
import helmet from 'helmet'
import { isProd } from './config/env'
import { requireAuth, originCheck } from './middleware/auth'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import { academicsRouter } from './routes/academics'
import { assistantRouter } from './routes/assistant'
import { insightsRouter } from './routes/insights'
import { interviewRouter } from './routes/interview'
import { notificationsRouter } from './routes/notifications'
import { planRouter } from './routes/plan'
import { quizRouter } from './routes/quiz'
import { readinessRouter } from './routes/readiness'
import { statsRouter } from './routes/stats'
import { revisionRouter } from './routes/revision'
import { authRouter } from './routes/auth'
import { pool } from './db/client'

export function createApp(): Express {
  const app = express()
  app.disable('x-powered-by')
  app.use(
    helmet({
      // Vite-built bundles are same-origin scripts; no inline scripts are used.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // charts set inline styles
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  )
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())

  // ---- API ----
  const api = express.Router()
  api.use(originCheck)
  api.get('/health', async (_req, res) => {
    try {
      await pool.query('select 1')
      res.json({ status: 'ok', database: 'up' })
    } catch {
      res.status(503).json({ status: 'degraded', database: 'down' })
    }
  })
  api.use('/auth', authRouter)
  // All routers mounted below this line require a signed-in user.
  api.use(requireAuth)
  api.use(academicsRouter)
  api.use(insightsRouter)
  api.use(quizRouter)
  api.use(revisionRouter)
  api.use(interviewRouter)
  api.use(planRouter)
  api.use(readinessRouter)
  api.use(notificationsRouter)
  api.use(statsRouter)
  api.use(assistantRouter)
  api.use(notFoundHandler)
  app.use('/api', api)

  // ---- Static frontend (production build) ----
  const distDir = path.resolve(process.cwd(), 'dist')
  if (isProd && fs.existsSync(distDir)) {
    app.use(express.static(distDir, { index: false, maxAge: '1h' }))
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'))
    })
  }

  app.use(errorHandler)
  return app
}
