import { Router } from 'express'
import { currentUser } from '../middleware/auth'
import * as readinessService from '../services/readinessService'

export const readinessRouter = Router()

readinessRouter.get('/readiness', async (req, res) => {
  res.json({ readiness: await readinessService.recordReadinessSnapshot(currentUser(req).id) })
})
readinessRouter.get('/readiness/trend', async (req, res) => {
  res.json({ trend: await readinessService.getReadinessTrend(currentUser(req).id) })
})
