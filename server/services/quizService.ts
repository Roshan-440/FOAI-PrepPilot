import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { QuestionType, QuizAnswerResultDto, QuizAttemptDto, QuizAttemptSummaryDto, QuizResultDto, QuizSourceType } from '../../shared/quiz'
import { aiService } from './aiService'
import { db, schema } from '../db/client'
import { badRequest, conflict, notFound } from '../utils/errors'
import { getPrioritizedTopics } from './priorityService'
import { recomputeRevisionForTopic } from './revisionService'

const { quizAttempts, quizQuestions, quizAnswers, topics, subjects } = schema

interface TopicSeed { id: string; name: string; subjectId: string; subjectName: string; difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' }

async function pickTopics(userId: string, sourceType: QuizSourceType, topicId: string | undefined, subjectId: string | undefined, count: number): Promise<TopicSeed[]> {
  if (sourceType === 'TOPIC') {
    const [t] = await db
      .select({ id: topics.id, name: topics.name, subjectId: subjects.id, subjectName: subjects.name, difficulty: topics.difficulty })
      .from(topics).innerJoin(subjects, eq(subjects.id, topics.subjectId))
      .where(and(eq(topics.id, topicId ?? ''), eq(topics.userId, userId)))
    if (!t) throw notFound('Topic not found.')
    return [t]
  }
  if (sourceType === 'SUBJECT') {
    const rows = await db
      .select({ id: topics.id, name: topics.name, subjectId: subjects.id, subjectName: subjects.name, difficulty: topics.difficulty })
      .from(topics).innerJoin(subjects, eq(subjects.id, topics.subjectId))
      .where(and(eq(topics.subjectId, subjectId ?? ''), eq(topics.userId, userId)))
    if (rows.length === 0) throw notFound('This subject has no topics to quiz yet.')
    return rows
  }
  // WEAK and MIXED both draw from the student's full topic list, ranked by priority.
  const prioritized = await getPrioritizedTopics(userId)
  if (prioritized.length === 0) throw badRequest('Add some subjects and topics before taking a quiz.')
  const pool = sourceType === 'WEAK' ? prioritized.filter((p) => p.level !== 'LOW') : prioritized
  const chosen = (pool.length > 0 ? pool : prioritized).slice(0, Math.max(3, Math.min(count, 8)))
  return chosen.map((p) => ({ id: p.topicId, name: p.topicName, subjectId: p.subjectId, subjectName: p.subjectName, difficulty: 'INTERMEDIATE' as const }))
}

/** Spreads `count` questions across topics as evenly as possible, giving any remainder to the earliest (highest-priority) topics. */
function distributeCount(count: number, topicCount: number): number[] {
  const base = Math.floor(count / topicCount)
  const remainder = count % topicCount
  return Array.from({ length: topicCount }, (_, i) => base + (i < remainder ? 1 : 0)).filter((n) => n > 0)
}

const TITLES: Record<QuizSourceType, (n: string) => string> = {
  TOPIC: (n) => `Quiz: ${n}`, SUBJECT: (n) => `Quiz: ${n}`, WEAK: () => 'Quiz: Your weak topics', MIXED: () => 'Quiz: Mixed review',
}

export async function startQuiz(userId: string, sourceType: QuizSourceType, topicId: string | undefined, subjectId: string | undefined, count: number): Promise<QuizAttemptDto> {
  const seeds = await pickTopics(userId, sourceType, topicId, subjectId, count)
  const perTopicCounts = distributeCount(count, seeds.length)
  const usedSeeds = seeds.slice(0, perTopicCounts.length)

  const generated = await Promise.all(usedSeeds.map((t, i) => aiService.generateQuizQuestions(t.name, t.subjectName, t.difficulty, perTopicCounts[i] ?? 1)))

  const title = sourceType === 'SUBJECT' ? TITLES.SUBJECT(usedSeeds[0]?.subjectName ?? 'Subject') : sourceType === 'TOPIC' ? TITLES.TOPIC(usedSeeds[0]?.name ?? 'Topic') : TITLES[sourceType]('')

  return db.transaction(async (tx) => {
    const [attempt] = await tx
      .insert(quizAttempts)
      .values({ userId, title, sourceType, subjectId: sourceType === 'SUBJECT' ? subjectId : null, topicId: sourceType === 'TOPIC' ? topicId : null, totalCount: 0 })
      .returning()
    if (!attempt) throw new Error('Failed to create quiz attempt')

    const questionRows: (typeof quizQuestions.$inferSelect)[] = []
    for (let ti = 0; ti < usedSeeds.length; ti++) {
      const seed = usedSeeds[ti]
      if (!seed) continue
      const { data: questions, source } = generated[ti] ?? { data: [], source: 'FALLBACK_BANK' as const }
      for (const q of questions) {
        const [row] = await tx
          .insert(quizQuestions)
          .values({ userId, topicId: seed.id, type: q.type as QuestionType, question: q.question, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation, difficulty: seed.difficulty, source })
          .returning()
        if (row) questionRows.push(row)
      }
    }
    await tx.update(quizAttempts).set({ totalCount: questionRows.length }).where(eq(quizAttempts.id, attempt.id))

    const topicNameById = new Map(usedSeeds.map((s) => [s.id, s.name]))
    return {
      id: attempt.id, title, sourceType, status: 'IN_PROGRESS', score: null, correctCount: null, totalCount: questionRows.length,
      startedAt: attempt.startedAt.toISOString(), submittedAt: null,
      questions: questionRows.map((q) => ({ id: q.id, type: q.type, question: q.question, options: q.options, topicId: q.topicId, topicName: topicNameById.get(q.topicId) ?? '', difficulty: q.difficulty })),
    }
  })
}

export async function getQuizAttempt(userId: string, attemptId: string): Promise<QuizAttemptDto | QuizResultDto> {
  const [attempt] = await db.select().from(quizAttempts).where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, userId)))
  if (!attempt) throw notFound('Quiz not found.')
  const qRows = await db
    .select({ q: quizQuestions, topicName: topics.name })
    .from(quizQuestions)
    .innerJoin(topics, eq(topics.id, quizQuestions.topicId))
    .innerJoin(quizAnswers, eq(quizAnswers.questionId, quizQuestions.id))
    .where(eq(quizAnswers.attemptId, attemptId))

  const answerRows = attempt.status === 'SUBMITTED' ? await db.select().from(quizAnswers).where(eq(quizAnswers.attemptId, attemptId)) : []
  const answerByQuestion = new Map(answerRows.map((a) => [a.questionId, a]))

  const summary: QuizAttemptSummaryDto = {
    id: attempt.id, title: attempt.title, sourceType: attempt.sourceType as QuizSourceType, status: attempt.status,
    score: attempt.score, correctCount: attempt.correctCount, totalCount: attempt.totalCount,
    startedAt: attempt.startedAt.toISOString(), submittedAt: attempt.submittedAt?.toISOString() ?? null,
  }

  if (attempt.status === 'IN_PROGRESS') {
    return { ...summary, questions: qRows.map(({ q, topicName }) => ({ id: q.id, type: q.type, question: q.question, options: q.options, topicId: q.topicId, topicName, difficulty: q.difficulty })) }
  }

  const questions: QuizAnswerResultDto[] = qRows.map(({ q, topicName }) => {
    const a = answerByQuestion.get(q.id)
    return { id: q.id, type: q.type, question: q.question, options: q.options, topicId: q.topicId, topicName, difficulty: q.difficulty, correctAnswer: q.correctAnswer, explanation: q.explanation, userAnswer: a?.answer ?? null, isCorrect: a?.isCorrect ?? null }
  })
  return { ...summary, questions, ...buildResultExtras(questions) }
}

function buildResultExtras(questions: QuizAnswerResultDto[]): Pick<QuizResultDto, 'weakTopics' | 'recommendedActions'> {
  const byTopic = new Map<string, { topicName: string; correct: number; total: number }>()
  for (const q of questions) {
    const cur = byTopic.get(q.topicId) ?? { topicName: q.topicName, correct: 0, total: 0 }
    cur.total += 1
    if (q.isCorrect) cur.correct += 1
    byTopic.set(q.topicId, cur)
  }
  const weakTopics = [...byTopic.entries()]
    .filter(([, v]) => v.total > 0 && v.correct / v.total < 0.7)
    .map(([topicId, v]) => ({ topicId, topicName: v.topicName, correctCount: v.correct, totalCount: v.total }))
  const recommendedActions = weakTopics.length > 0
    ? [`Revise: ${weakTopics.map((t) => t.topicName).join(', ')}`, 'Retake a focused quiz on these topics once you have revised.']
    : ['Great result — try a mixed quiz next to keep your other subjects sharp.']
  return { weakTopics, recommendedActions }
}

function looksCorrect(userAnswer: string, correctAnswer: string, type: QuestionType): boolean {
  const a = userAnswer.trim().toLowerCase()
  const c = correctAnswer.trim().toLowerCase()
  if (a.length === 0) return false
  if (type !== 'SHORT_ANSWER') return a === c
  // Short answers are graded leniently: credit if the answer references the core idea of the model answer.
  const keywords = c.split(/\W+/).filter((w) => w.length > 3)
  if (keywords.length === 0) return a.includes(c)
  return keywords.some((k) => a.includes(k))
}

export async function submitQuiz(userId: string, attemptId: string, answers: { questionId: string; answer: string }[]): Promise<QuizResultDto> {
  const [attempt] = await db.select().from(quizAttempts).where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, userId)))
  if (!attempt) throw notFound('Quiz not found.')
  if (attempt.status === 'SUBMITTED') throw conflict('This quiz has already been submitted.')

  const questionRows = await db.select().from(quizQuestions).where(and(eq(quizQuestions.userId, userId), inArray(quizQuestions.id, answers.map((a) => a.questionId))))
  const questionById = new Map(questionRows.map((q) => [q.id, q]))
  // Only accept answers for questions that actually belong to this attempt's topic set and to this user.
  const validAnswers = answers.filter((a) => questionById.has(a.questionId))
  if (validAnswers.length === 0) throw badRequest('No valid answers were submitted for this quiz.')

  let correctCount = 0
  const perTopic = new Map<string, { correct: number; total: number }>()

  await db.transaction(async (tx) => {
    for (const a of validAnswers) {
      const q = questionById.get(a.questionId)
      if (!q) continue
      const isCorrect = looksCorrect(a.answer, q.correctAnswer, q.type)
      if (isCorrect) correctCount += 1
      const t = perTopic.get(q.topicId) ?? { correct: 0, total: 0 }
      t.total += 1
      if (isCorrect) t.correct += 1
      perTopic.set(q.topicId, t)
      await tx
        .insert(quizAnswers)
        .values({ userId, attemptId, questionId: a.questionId, position: 0, answer: a.answer, isCorrect })
        .onConflictDoUpdate({ target: [quizAnswers.attemptId, quizAnswers.questionId], set: { answer: a.answer, isCorrect } })
    }
    const totalAnswered = validAnswers.length
    const score = totalAnswered === 0 ? 0 : Math.round((correctCount / totalAnswered) * 100)
    await tx.update(quizAttempts).set({ status: 'SUBMITTED', score, correctCount, submittedAt: sql`now()` }).where(eq(quizAttempts.id, attemptId))

    // Feed results back into each affected topic's tracked score, so priority/readiness reflect real performance.
    for (const [topicId, stat] of perTopic) {
      const topicScore = Math.round((stat.correct / stat.total) * 100)
      await tx.update(topics).set({ lastScore: topicScore, lastStudiedAt: sql`now()` }).where(and(eq(topics.id, topicId), eq(topics.userId, userId)))
    }
  })

  for (const topicId of perTopic.keys()) await recomputeRevisionForTopic(userId, topicId)

  return getQuizAttempt(userId, attemptId) as Promise<QuizResultDto>
}

export async function listQuizHistory(userId: string): Promise<QuizAttemptSummaryDto[]> {
  const rows = await db.select().from(quizAttempts).where(eq(quizAttempts.userId, userId)).orderBy(desc(quizAttempts.startedAt))
  return rows.map((a) => ({ id: a.id, title: a.title, sourceType: a.sourceType as QuizSourceType, status: a.status, score: a.score, correctCount: a.correctCount, totalCount: a.totalCount, startedAt: a.startedAt.toISOString(), submittedAt: a.submittedAt?.toISOString() ?? null }))
}
