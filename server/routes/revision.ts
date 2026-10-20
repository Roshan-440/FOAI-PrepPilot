import { Router } from 'express'
import { z } from 'zod'
import { currentUser } from '../middleware/auth'
import * as revisionService from '../services/revisionService'
import { notFound } from '../utils/errors'

const idParam = (raw: unknown): string => {
  const parsed = z.uuid().safeParse(raw)
  if (!parsed.success) throw notFound()
  return parsed.data
}

export const revisionRouter = Router()

revisionRouter.get('/revision', async (req, res) => {
  res.json({ recommendations: await revisionService.listActiveRevisions(currentUser(req).id) })
})
revisionRouter.post('/revision/:id/dismiss', async (req, res) => {
  const ok = await revisionService.dismissRevision(currentUser(req).id, idParam(req.params.id))
  if (!ok) throw notFound('Recommendation not found.')
  res.status(204).end()
})
