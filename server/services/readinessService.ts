import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '../db/client'

const { topics, revisionRecommendations, interviewAnswers, mockInterviews, readinessScores } = schema

export interface ReadinessFactor { label: string; detail: string; contribution: number }
export interface ReadinessResult {
  academic: number; interview: number; overall: number
  academicFactors: ReadinessFactor[]; interviewFactors: ReadinessFactor[]
  recommendedNextSteps: string[]
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

/**
 * Deterministic readiness calculation — never random, always explainable from the student's real activity.
 * Academic readiness weighs topic completion, quiz performance, weak-topic ratio, and revision follow-through.
 * Interview readiness weighs technical/HR question coverage, question-practice volume, and mock interview results.
 */
export async function computeReadiness(userId: string): Promise<ReadinessResult> {
  const topicRows = await db.select({ status: topics.status, lastScore: topics.lastScore, confidence: topics.confidence }).from(topics).where(eq(topics.userId, userId))
  const totalTopics = topicRows.length
  const completedTopics = topicRows.filter((t) => t.status === 'COMPLETED').length
  const scoredTopics = topicRows.filter((t) => t.lastScore !== null)
  const avgQuizScore = scoredTopics.length > 0 ? scoredTopics.reduce((s, t) => s + (t.lastScore ?? 0), 0) / scoredTopics.length : null
  const weakTopics = topicRows.filter((t) => (t.lastScore !== null && t.lastScore < 70) || (t.confidence !== null && t.confidence <= 2)).length

  const [resolvedRevisions] = await db.select({ n: schema.revisionRecommendations.id }).from(revisionRecommendations).where(and(eq(revisionRecommendations.userId, userId), eq(revisionRecommendations.status, 'DONE'))).limit(1)
  const revisionRows = await db.select({ status: revisionRecommendations.status }).from(revisionRecommendations).where(eq(revisionRecommendations.userId, userId))
  const revisionTotal = revisionRows.length
  const revisionDone = revisionRows.filter((r) => r.status === 'DONE').length
  void resolvedRevisions

  const academicFactors: ReadinessFactor[] = []
  const completionFrac = totalTopics === 0 ? 0 : completedTopics / totalTopics
  academicFactors.push({ label: 'Topic completion', detail: totalTopics === 0 ? 'No topics added yet' : `${completedTopics} of ${totalTopics} topics completed`, contribution: Math.round(completionFrac * 40) })
  const quizFrac = avgQuizScore === null ? 0 : avgQuizScore / 100
  academicFactors.push({ label: 'Quiz performance', detail: avgQuizScore === null ? 'No quizzes taken yet' : `Average score ${Math.round(avgQuizScore)}%`, contribution: Math.round(quizFrac * 30) })
  const weakFrac = totalTopics === 0 ? 0 : 1 - weakTopics / totalTopics
  academicFactors.push({ label: 'Weak topics', detail: totalTopics === 0 ? 'No topics added yet' : `${weakTopics} topic(s) currently weak`, contribution: Math.round(weakFrac * 15) })
  const revisionFrac = revisionTotal === 0 ? 0.5 : revisionDone / revisionTotal
  academicFactors.push({ label: 'Revision follow-through', detail: revisionTotal === 0 ? 'No revisions recommended yet' : `${revisionDone} of ${revisionTotal} revisions completed`, contribution: Math.round(revisionFrac * 15) })
  const academic = totalTopics === 0 ? 0 : clamp(academicFactors.reduce((s, f) => s + f.contribution, 0))

  const answers = await db.select({ overallScore: interviewAnswers.overallScore }).from(interviewAnswers).where(eq(interviewAnswers.userId, userId))
  const mocks = await db.select({ status: mockInterviews.status, overallScore: mockInterviews.overallScore }).from(mockInterviews).where(eq(mockInterviews.userId, userId))
  const completedMocks = mocks.filter((m) => m.status === 'COMPLETED' && m.overallScore !== null)
  const avgMockScore = completedMocks.length > 0 ? completedMocks.reduce((s, m) => s + (m.overallScore ?? 0), 0) / completedMocks.length : null
  const avgAnswerScore = answers.length > 0 ? answers.reduce((s, a) => s + a.overallScore, 0) / answers.length : null

  const interviewFactors: ReadinessFactor[] = []
  const practiceVolumeFrac = Math.min(1, answers.length / 20)
  interviewFactors.push({ label: 'Question practice volume', detail: `${answers.length} question(s) answered`, contribution: Math.round(practiceVolumeFrac * 20) })
  const answerQualityFrac = avgAnswerScore === null ? 0 : avgAnswerScore / 100
  interviewFactors.push({ label: 'Answer quality', detail: avgAnswerScore === null ? 'No practice answers yet' : `Average answer score ${Math.round(avgAnswerScore)}%`, contribution: Math.round(answerQualityFrac * 25) })
  const mockVolumeFrac = Math.min(1, completedMocks.length / 3)
  interviewFactors.push({ label: 'Mock interviews completed', detail: `${completedMocks.length} completed`, contribution: Math.round(mockVolumeFrac * 15) })
  const mockQualityFrac = avgMockScore === null ? 0 : avgMockScore / 100
  interviewFactors.push({ label: 'Mock interview performance', detail: avgMockScore === null ? 'No completed mock interviews yet' : `Average score ${Math.round(avgMockScore)}%`, contribution: Math.round(mockQualityFrac * 40) })
  const interview = answers.length === 0 && completedMocks.length === 0 ? 0 : clamp(interviewFactors.reduce((s, f) => s + f.contribution, 0))

  const overall = clamp(academic * 0.55 + interview * 0.45)

  const recommendedNextSteps: string[] = []
  const weakestAcademic = [...academicFactors].filter((f) => f.contribution < 20).sort((a, b) => a.contribution - b.contribution)[0]
  if (totalTopics === 0) recommendedNextSteps.push('Add your subjects and topics to start tracking academic readiness.')
  else if (weakTopics > 0) recommendedNextSteps.push(`Revise your ${weakTopics} weak topic(s) — check the Revision page for specifics.`)
  else if (weakestAcademic) recommendedNextSteps.push(`Focus on ${weakestAcademic.label.toLowerCase()} to raise your academic readiness.`)
  if (answers.length < 10) recommendedNextSteps.push('Practice at least 10 interview questions to build a reliable readiness signal.')
  if (completedMocks.length === 0) recommendedNextSteps.push('Take a mock interview to measure your interview readiness.')
  if (recommendedNextSteps.length === 0) recommendedNextSteps.push('Keep up your current pace — take another mock interview or quiz to push your scores higher.')

  return { academic, interview, overall, academicFactors, interviewFactors, recommendedNextSteps: recommendedNextSteps.slice(0, 4) }
}

/** Computes fresh readiness and records a trend snapshot only when it actually changed, so history stays meaningful without growing unbounded. */
export async function recordReadinessSnapshot(userId: string): Promise<ReadinessResult> {
  const result = await computeReadiness(userId)
  const [latest] = await db.select().from(readinessScores).where(eq(readinessScores.userId, userId)).orderBy(desc(readinessScores.computedAt)).limit(1)
  const changed = !latest || latest.academic !== result.academic || latest.interview !== result.interview || latest.overall !== result.overall
  if (changed) {
    await db.insert(readinessScores).values({ userId, academic: result.academic, interview: result.interview, overall: result.overall, factors: { academicFactors: result.academicFactors, interviewFactors: result.interviewFactors } })
  }
  return result
}

export interface ReadinessTrendPoint { date: string; academic: number; interview: number; overall: number }
export async function getReadinessTrend(userId: string): Promise<ReadinessTrendPoint[]> {
  const rows = await db.select().from(readinessScores).where(eq(readinessScores.userId, userId)).orderBy(readinessScores.computedAt)
  return rows.map((r) => ({ date: r.computedAt.toISOString(), academic: r.academic, interview: r.interview, overall: r.overall }))
}
