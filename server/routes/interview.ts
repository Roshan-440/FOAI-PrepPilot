import { Router } from 'express'
import { z } from 'zod'
import { answerMockQuestionSchema, answerPracticeQuestionSchema, generateQuestionsSchema, startMockInterviewSchema } from '../../shared/interview'
import { currentUser } from '../middleware/auth'
import * as interviewService from '../services/interviewService'
import { notFound } from '../utils/errors'

const idParam = (raw: unknown): string => {
  const parsed = z.uuid().safeParse(raw)
  if (!parsed.success) throw notFound()
  return parsed.data
}
const categoryQuery = z.enum(['TECHNICAL', 'HR', 'BEHAVIORAL', 'PROJECT']).optional()
const difficultyQuery = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional()

export const interviewRouter = Router()

interviewRouter.get('/interview/questions', async (req, res) => {
  const category = categoryQuery.parse(req.query.category)
  const difficulty = difficultyQuery.parse(req.query.difficulty)
  res.json({ questions: await interviewService.listPracticeQuestions(currentUser(req).id, category, difficulty) })
})
interviewRouter.post('/interview/questions/generate', async (req, res) => {
  const input = generateQuestionsSchema.parse(req.body)
  res.status(201).json({ questions: await interviewService.generateInterviewQuestions(currentUser(req).id, input.role, input.category, input.difficulty, input.count) })
})
interviewRouter.post('/interview/questions/:id/answer', async (req, res) => {
  const input = answerPracticeQuestionSchema.omit({ questionId: true }).parse(req.body)
  res.status(201).json({ answer: await interviewService.answerPracticeQuestion(currentUser(req).id, idParam(req.params.id), input.answer) })
})

interviewRouter.get('/mock-interviews', async (req, res) => {
  res.json({ mockInterviews: await interviewService.listMockInterviews(currentUser(req).id) })
})
interviewRouter.post('/mock-interviews', async (req, res) => {
  const input = startMockInterviewSchema.parse(req.body)
  res.status(201).json({ mockInterview: await interviewService.startMockInterview(currentUser(req).id, input.role, input.type, input.difficulty, input.questionCount) })
})
interviewRouter.get('/mock-interviews/:id', async (req, res) => {
  res.json({ mockInterview: await interviewService.getMockInterview(currentUser(req).id, idParam(req.params.id)) })
})
interviewRouter.post('/mock-interviews/:id/questions/:questionId/answer', async (req, res) => {
  const input = answerMockQuestionSchema.parse(req.body)
  res.status(201).json({ answer: await interviewService.answerMockQuestion(currentUser(req).id, idParam(req.params.id), idParam(req.params.questionId), input.answer) })
})
interviewRouter.post('/mock-interviews/:id/complete', async (req, res) => {
  res.json({ mockInterview: await interviewService.completeMockInterview(currentUser(req).id, idParam(req.params.id)) })
})
