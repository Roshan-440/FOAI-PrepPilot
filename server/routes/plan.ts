import { Router } from 'express'
import { z } from 'zod'
import { generatePlanSchema } from '../../shared/plan'
import { currentUser } from '../middleware/auth'
import * as planService from '../services/studyPlanService'
import { notFound } from '../utils/errors'

const idParam = (raw: unknown): string => {
  const parsed = z.uuid().safeParse(raw)
  if (!parsed.success) throw notFound()
  return parsed.data
}

export const planRouter = Router()

planRouter.get('/plan', async (req, res) => {
  const userId = currentUser(req).id
  await planService.rescheduleMissedTasks(userId)
  res.json({ plan: await planService.getActivePlan(userId) })
})
planRouter.post('/plan', async (req, res) => {
  const input = generatePlanSchema.parse(req.body)
  res.status(201).json({ plan: await planService.generateAndSavePlan(currentUser(req).id, input) })
})
planRouter.post('/plan/tasks/:id/complete', async (req, res) => {
  res.json({ task: await planService.completeTask(currentUser(req).id, idParam(req.params.id)) })
})
planRouter.post('/plan/tasks/:id/skip', async (req, res) => {
  res.json({ task: await planService.skipTask(currentUser(req).id, idParam(req.params.id)) })
})
