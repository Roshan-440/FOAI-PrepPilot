import { Router } from 'express'
import { startQuizSchema, submitQuizSchema } from '../../shared/quiz'
import { currentUser } from '../middleware/auth'
import * as quizService from '../services/quizService'
import { notFound } from '../utils/errors'
import { z } from 'zod'

const idParam = (raw: unknown): string => {
  const parsed = z.uuid().safeParse(raw)
  if (!parsed.success) throw notFound()
  return parsed.data
}

export const quizRouter = Router()

quizRouter.get('/quizzes', async (req, res) => {
  res.json({ quizzes: await quizService.listQuizHistory(currentUser(req).id) })
})
quizRouter.post('/quizzes', async (req, res) => {
  const input = startQuizSchema.parse(req.body)
  res.status(201).json({ quiz: await quizService.startQuiz(currentUser(req).id, input.sourceType, input.topicId, input.subjectId, input.count) })
})
quizRouter.get('/quizzes/:id', async (req, res) => {
  res.json({ quiz: await quizService.getQuizAttempt(currentUser(req).id, idParam(req.params.id)) })
})
quizRouter.post('/quizzes/:id/submit', async (req, res) => {
  const input = submitQuizSchema.parse(req.body)
  res.json({ quiz: await quizService.submitQuiz(currentUser(req).id, idParam(req.params.id), input.answers) })
})
