import { Router } from 'express'
import { currentUser } from '../middleware/auth'
import { getPrioritizedTopics } from '../services/priorityService'

export const insightsRouter = Router()

insightsRouter.get('/priority-topics', async (req, res) => {
  const topics = await getPrioritizedTopics(currentUser(req).id)
  res.json({ topics })
})
