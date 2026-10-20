import { Router } from 'express'
import { z } from 'zod'
import { profileInputSchema, subjectInputSchema, subjectUpdateSchema, topicInputSchema, topicUpdateSchema } from '../../shared/academics'
import { currentUser } from '../middleware/auth'
import * as profileService from '../services/profileService'
import { recomputeRevisionForTopic } from '../services/revisionService'
import * as subjectService from '../services/subjectService'
import * as topicService from '../services/topicService'
import { notFound } from '../utils/errors'

/** A malformed id can never match a record, so it is reported as 404 rather than a database error. */
const idParam = (raw: unknown): string => {
  const parsed = z.uuid().safeParse(raw)
  if (!parsed.success) throw notFound()
  return parsed.data
}

export const academicsRouter = Router()

academicsRouter.get('/profile', async (req, res) => {
  res.json({ profile: await profileService.getProfile(currentUser(req).id) })
})
academicsRouter.put('/profile', async (req, res) => {
  const input = profileInputSchema.parse(req.body)
  res.json({ profile: await profileService.updateProfile(currentUser(req).id, input) })
})

academicsRouter.get('/subjects', async (req, res) => {
  res.json({ subjects: await subjectService.listSubjects(currentUser(req).id) })
})
academicsRouter.post('/subjects', async (req, res) => {
  const input = subjectInputSchema.parse(req.body)
  res.status(201).json({ subject: await subjectService.createSubject(currentUser(req).id, input) })
})
academicsRouter.get('/subjects/:id', async (req, res) => {
  const userId = currentUser(req).id
  const id = idParam(req.params.id)
  const [subject, topics] = await Promise.all([subjectService.getSubject(userId, id), topicService.listTopics(userId, id)])
  res.json({ subject, topics })
})
academicsRouter.patch('/subjects/:id', async (req, res) => {
  const input = subjectUpdateSchema.parse(req.body)
  res.json({ subject: await subjectService.updateSubject(currentUser(req).id, idParam(req.params.id), input) })
})
academicsRouter.delete('/subjects/:id', async (req, res) => {
  await subjectService.deleteSubject(currentUser(req).id, idParam(req.params.id))
  res.status(204).end()
})
academicsRouter.post('/subjects/:id/topics', async (req, res) => {
  const input = topicInputSchema.parse(req.body)
  res.status(201).json({ topic: await topicService.createTopic(currentUser(req).id, idParam(req.params.id), input) })
})

academicsRouter.get('/topics', async (req, res) => {
  res.json({ topics: await topicService.listTopics(currentUser(req).id) })
})
academicsRouter.patch('/topics/:id', async (req, res) => {
  const input = topicUpdateSchema.parse(req.body)
  const userId = currentUser(req).id
  const id = idParam(req.params.id)
  const topic = await topicService.updateTopic(userId, id, input)
  await recomputeRevisionForTopic(userId, id)
  res.json({ topic })
})
academicsRouter.delete('/topics/:id', async (req, res) => {
  await topicService.deleteTopic(currentUser(req).id, idParam(req.params.id))
  res.status(204).end()
})
