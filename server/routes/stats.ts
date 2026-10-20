import { Router } from 'express'
import { currentUser } from '../middleware/auth'
import { getStudyStats } from '../services/studyPlanService'

export const statsRouter = Router()

statsRouter.get('/stats/today', async (req, res) => {
  res.json({ stats: await getStudyStats(currentUser(req).id) })
})
