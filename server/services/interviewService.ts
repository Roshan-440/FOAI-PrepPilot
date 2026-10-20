import { and, desc, eq, isNull, or, sql } from 'drizzle-orm'
import type { AnswerScoresDto, InterviewAnswerDto, InterviewCategory, InterviewQuestionDto, MockInterviewDto, MockInterviewReport, MockInterviewSummaryDto, MockInterviewType } from '../../shared/interview'
import { aiService } from './aiService'
import { db, schema } from '../db/client'
import { badRequest, conflict, notFound } from '../utils/errors'
import { notify } from './notificationService'

const { interviewQuestions, interviewAnswers, mockInterviews, mockInterviewQuestions, userSkills, skills, subjects } = schema

async function studentContext(userId: string): Promise<{ skills: string[]; subjects: string[] }> {
  const [skillRows, subjectRows] = await Promise.all([
    db.select({ name: skills.displayName }).from(userSkills).innerJoin(skills, eq(skills.id, userSkills.skillId)).where(eq(userSkills.userId, userId)),
    db.select({ name: subjects.name }).from(subjects).where(eq(subjects.userId, userId)),
  ])
  return { skills: skillRows.map((s) => s.name), subjects: subjectRows.map((s) => s.name) }
}

function toQuestionDto(q: typeof interviewQuestions.$inferSelect): InterviewQuestionDto {
  return { id: q.id, role: q.role, category: q.category, difficulty: q.difficulty, topic: q.topic, question: q.question, testing: q.testing, keyPoints: q.keyPoints, source: q.source }
}

/** Generates fresh practice questions for the student's role/category/difficulty, avoiding duplicates of what they've already been asked in this category this session. */
export async function generateInterviewQuestions(userId: string, role: string, category: InterviewCategory, difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED', count: number): Promise<InterviewQuestionDto[]> {
  const context = await studentContext(userId)
  const existing = await db.select({ question: interviewQuestions.question }).from(interviewQuestions).where(and(eq(interviewQuestions.userId, userId), eq(interviewQuestions.category, category)))
  const seen = new Set(existing.map((e) => e.question))

  const { data: generated, source } = await aiService.generateInterviewQuestions(role, category, difficulty, count + existing.length, context)
  const fresh = generated.filter((q) => !seen.has(q.question)).slice(0, count)
  if (fresh.length === 0) throw badRequest('No new questions could be generated right now — try a different category or difficulty.')

  const rows = await db.insert(interviewQuestions).values(fresh.map((q) => ({ userId, role, category: q.category, difficulty, topic: q.topic, question: q.question, testing: q.testing, keyPoints: q.keyPoints, source }))).returning()
  return rows.map(toQuestionDto)
}

export async function listPracticeQuestions(userId: string, category?: InterviewCategory, difficulty?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'): Promise<InterviewQuestionDto[]> {
  const conditions = [or(eq(interviewQuestions.userId, userId), isNull(interviewQuestions.userId))]
  if (category) conditions.push(eq(interviewQuestions.category, category))
  if (difficulty) conditions.push(eq(interviewQuestions.difficulty, difficulty))
  const rows = await db.select().from(interviewQuestions).where(and(...conditions)).orderBy(desc(interviewQuestions.createdAt)).limit(60)
  return rows.map(toQuestionDto)
}

export async function answerPracticeQuestion(userId: string, questionId: string, answer: string): Promise<InterviewAnswerDto> {
  const [q] = await db.select().from(interviewQuestions).where(and(eq(interviewQuestions.id, questionId), or(eq(interviewQuestions.userId, userId), isNull(interviewQuestions.userId))))
  if (!q) throw notFound('Question not found.')
  const { data: evaluation, source } = await aiService.evaluateInterviewAnswer(q.question, q.keyPoints, answer)
  const [row] = await db
    .insert(interviewAnswers)
    .values({ userId, interviewQuestionId: questionId, answer, scores: evaluation.scores, overallScore: evaluation.overallScore, feedback: evaluation.feedback, evaluationSource: source })
    .returning()
  if (!row) throw new Error('Failed to record answer')
  return { id: row.id, questionId, answer, scores: evaluation.scores, overallScore: evaluation.overallScore, feedback: evaluation.feedback, evaluationSource: source }
}

// ---------------------------------------------------------------------------
// Mock interviews
// ---------------------------------------------------------------------------
const CATEGORY_MIX: Record<MockInterviewType, InterviewCategory[]> = {
  TECHNICAL: ['TECHNICAL', 'PROJECT'],
  HR: ['HR', 'BEHAVIORAL'],
  MIXED: ['TECHNICAL', 'HR', 'BEHAVIORAL', 'PROJECT'],
}

export async function startMockInterview(userId: string, role: string, type: MockInterviewType, difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED', questionCount: number): Promise<MockInterviewDto> {
  const context = await studentContext(userId)
  const categories = CATEGORY_MIX[type]
  const perCategory = Math.max(1, Math.ceil(questionCount / categories.length))
  const batches = await Promise.all(categories.map((cat) => aiService.generateInterviewQuestions(role, cat, difficulty, perCategory, context)))
  const pool = batches.flatMap((b) => b.data)
  const source = batches.some((b) => b.source === 'AI') ? 'AI' : 'FALLBACK_BANK'
  if (pool.length === 0) throw badRequest('Could not generate interview questions right now. Please try again.')
  const questions = pool.slice(0, questionCount)

  return db.transaction(async (tx) => {
    const [mock] = await tx.insert(mockInterviews).values({ userId, role, type, difficulty, questionCount: questions.length }).returning()
    if (!mock) throw new Error('Failed to start mock interview')
    const rows = await tx
      .insert(mockInterviewQuestions)
      .values(questions.map((q, i) => ({ userId, mockInterviewId: mock.id, position: i + 1, category: q.category, topic: q.topic, question: q.question, keyPoints: q.keyPoints, source: source as 'AI' | 'FALLBACK_BANK' })))
      .returning()
    return toMockDto(mock, rows, [])
  })
}

function toMockDto(mock: typeof mockInterviews.$inferSelect, questions: (typeof mockInterviewQuestions.$inferSelect)[], answers: (typeof interviewAnswers.$inferSelect)[]): MockInterviewDto {
  const answerByQuestion = new Map(answers.map((a) => [a.mockInterviewQuestionId, a]))
  return {
    id: mock.id, role: mock.role, type: mock.type, difficulty: mock.difficulty, questionCount: mock.questionCount,
    status: mock.status, overallScore: mock.overallScore, startedAt: mock.startedAt.toISOString(), completedAt: mock.completedAt?.toISOString() ?? null,
    questions: questions.sort((a, b) => a.position - b.position).map((q) => ({ id: q.id, position: q.position, category: q.category, topic: q.topic, question: q.question, keyPoints: q.keyPoints })),
    answers: Object.fromEntries(
      questions.filter((q) => answerByQuestion.has(q.id)).map((q) => {
        const a = answerByQuestion.get(q.id) as typeof interviewAnswers.$inferSelect
        return [q.id, { id: a.id, questionId: q.id, answer: a.answer, scores: a.scores as unknown as AnswerScoresDto, overallScore: a.overallScore, feedback: a.feedback, evaluationSource: a.evaluationSource } satisfies InterviewAnswerDto]
      }),
    ),
    report: (mock.report as MockInterviewReport | null) ?? null,
  }
}

export async function getMockInterview(userId: string, id: string): Promise<MockInterviewDto> {
  const [mock] = await db.select().from(mockInterviews).where(and(eq(mockInterviews.id, id), eq(mockInterviews.userId, userId)))
  if (!mock) throw notFound('Mock interview not found.')
  const questions = await db.select().from(mockInterviewQuestions).where(eq(mockInterviewQuestions.mockInterviewId, id))
  const answers = await db.select().from(interviewAnswers).where(and(eq(interviewAnswers.userId, userId), sql`${interviewAnswers.mockInterviewQuestionId} in (select id from mock_interview_questions where mock_interview_id = ${id})`))
  return toMockDto(mock, questions, answers)
}

export async function listMockInterviews(userId: string): Promise<MockInterviewSummaryDto[]> {
  const rows = await db.select().from(mockInterviews).where(eq(mockInterviews.userId, userId)).orderBy(desc(mockInterviews.startedAt))
  return rows.map((m) => ({ id: m.id, role: m.role, type: m.type, difficulty: m.difficulty, questionCount: m.questionCount, status: m.status, overallScore: m.overallScore, startedAt: m.startedAt.toISOString(), completedAt: m.completedAt?.toISOString() ?? null }))
}

export async function answerMockQuestion(userId: string, mockInterviewId: string, questionId: string, answer: string): Promise<InterviewAnswerDto> {
  const [mock] = await db.select().from(mockInterviews).where(and(eq(mockInterviews.id, mockInterviewId), eq(mockInterviews.userId, userId)))
  if (!mock) throw notFound('Mock interview not found.')
  if (mock.status === 'COMPLETED') throw conflict('This mock interview has already finished.')
  const [q] = await db.select().from(mockInterviewQuestions).where(and(eq(mockInterviewQuestions.id, questionId), eq(mockInterviewQuestions.mockInterviewId, mockInterviewId)))
  if (!q) throw notFound('Question not found in this mock interview.')

  const { data: evaluation, source } = await aiService.evaluateInterviewAnswer(q.question, q.keyPoints, answer)
  const [row] = await db
    .insert(interviewAnswers)
    .values({ userId, mockInterviewQuestionId: questionId, answer, scores: evaluation.scores, overallScore: evaluation.overallScore, feedback: evaluation.feedback, evaluationSource: source })
    .onConflictDoUpdate({ target: interviewAnswers.mockInterviewQuestionId, set: { answer, scores: evaluation.scores, overallScore: evaluation.overallScore, feedback: evaluation.feedback, evaluationSource: source } })
    .returning()
  if (!row) throw new Error('Failed to record answer')
  return { id: row.id, questionId, answer, scores: evaluation.scores, overallScore: evaluation.overallScore, feedback: evaluation.feedback, evaluationSource: source }
}

export async function completeMockInterview(userId: string, mockInterviewId: string): Promise<MockInterviewDto> {
  const [mock] = await db.select().from(mockInterviews).where(and(eq(mockInterviews.id, mockInterviewId), eq(mockInterviews.userId, userId)))
  if (!mock) throw notFound('Mock interview not found.')
  if (mock.status === 'COMPLETED') return getMockInterview(userId, mockInterviewId)

  const questions = await db.select().from(mockInterviewQuestions).where(eq(mockInterviewQuestions.mockInterviewId, mockInterviewId))
  const answers = await db.select().from(interviewAnswers).where(sql`${interviewAnswers.mockInterviewQuestionId} in (select id from mock_interview_questions where mock_interview_id = ${mockInterviewId})`)
  if (answers.length === 0) throw badRequest('Answer at least one question before finishing the interview.')

  const overallScore = Math.round(answers.reduce((s, a) => s + a.overallScore, 0) / answers.length)
  const answerByQuestion = new Map(answers.map((a) => [a.mockInterviewQuestionId, a]))
  const strengths: string[] = []
  const weaknesses: string[] = []
  const recommendedTopics: string[] = []
  for (const q of questions) {
    const a = answerByQuestion.get(q.id)
    if (!a) { recommendedTopics.push(q.topic); continue }
    if (a.overallScore >= 75) strengths.push(q.topic)
    else { weaknesses.push(q.topic); recommendedTopics.push(q.topic) }
  }
  const report: MockInterviewReport = {
    overallScore,
    strengths: [...new Set(strengths)].slice(0, 5).length > 0 ? [...new Set(strengths)].slice(0, 5) : ['Keep practicing to build up clear strengths.'],
    weaknesses: [...new Set(weaknesses)].slice(0, 5).length > 0 ? [...new Set(weaknesses)].slice(0, 5) : ['No major weak areas identified this time.'],
    recommendedTopics: [...new Set(recommendedTopics)].slice(0, 5),
    suggestedImprovements: overallScore >= 75
      ? ['Keep answers concise and specific with measurable outcomes.', 'Practice a harder difficulty to keep improving.']
      : ['Structure answers with a clear situation, action, and result.', 'Review the key points listed for each missed question before your next attempt.'],
  }

  await db.update(mockInterviews).set({ status: 'COMPLETED', overallScore, report: report as unknown as Record<string, unknown>, completedAt: sql`now()` }).where(eq(mockInterviews.id, mockInterviewId))
  await notify(userId, 'MOCK_INTERVIEW_COMPLETED', 'Mock interview completed', `Your ${mock.role} mock interview scored ${overallScore}%. ${overallScore >= 75 ? 'Great work!' : 'Check the report for what to practice next.'}`)
  return getMockInterview(userId, mockInterviewId)
}
