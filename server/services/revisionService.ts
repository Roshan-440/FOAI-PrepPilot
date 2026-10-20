import { and, eq } from 'drizzle-orm'
import { computeTopicPriority } from '../../shared/priority'
import { db, schema } from '../db/client'
import { notify } from './notificationService'

const { topics, subjects, profiles, revisionRecommendations } = schema

function daysSince(date: Date | null, now: Date): number | null {
  if (!date) return null
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000)
}

/** Recomputes whether a topic needs revision and keeps its ACTIVE recommendation row in sync (creates, updates, or resolves it). Called after topic/quiz updates so the revision list is always current. */
export async function recomputeRevisionForTopic(userId: string, topicId: string, now: Date = new Date()): Promise<void> {
  const [row] = await db
    .select({
      status: topics.status, confidence: topics.confidence, lastScore: topics.lastScore, importance: topics.importance,
      lastStudiedAt: topics.lastStudiedAt, subjectExamDate: subjects.examDate,
    })
    .from(topics)
    .innerJoin(subjects, eq(subjects.id, topics.subjectId))
    .where(and(eq(topics.id, topicId), eq(topics.userId, userId)))
  if (!row) return

  const reasons: string[] = []
  if (row.status === 'NEEDS_REVISION') reasons.push('this topic was marked as needing revision')
  if (row.lastScore !== null && row.lastScore < 70) reasons.push(`your last quiz score was ${row.lastScore}%`)
  if (row.confidence !== null && row.confidence <= 2) reasons.push('your confidence level is low')
  const staleDays = daysSince(row.lastStudiedAt, now)
  const isStale = row.status === 'COMPLETED' && row.importance >= 4 && staleDays !== null && staleDays >= 21
  if (isStale) reasons.push(`it's been ${staleDays} days since you last studied it`)

  const needsRevision = reasons.length > 0
  const [existing] = await db.select({ id: revisionRecommendations.id }).from(revisionRecommendations).where(and(eq(revisionRecommendations.topicId, topicId), eq(revisionRecommendations.status, 'ACTIVE')))

  if (!needsRevision) {
    if (existing) await db.update(revisionRecommendations).set({ status: 'DONE', resolvedAt: now }).where(eq(revisionRecommendations.id, existing.id))
    return
  }

  const [profile] = await db.select({ examDate: profiles.examDate }).from(profiles).where(eq(profiles.userId, userId))
  const score = computeTopicPriority({
    status: row.status, importance: row.importance, interviewRelevance: 3, confidence: row.confidence, lastScore: row.lastScore,
    daysUntilExam: null, daysUntilInterview: null,
  }).score
  void profile
  const reason = `Recommended for revision because ${reasons.join(' and ')}.`

  if (existing) {
    await db.update(revisionRecommendations).set({ reason, score }).where(eq(revisionRecommendations.id, existing.id))
  } else {
    await db.insert(revisionRecommendations).values({ userId, topicId, reason, score, status: 'ACTIVE' })
    const [topicRow] = await db.select({ name: topics.name }).from(topics).where(eq(topics.id, topicId))
    await notify(userId, 'REVISION_RECOMMENDED', 'New revision recommended', `${topicRow?.name ?? 'A topic'} was flagged for revision. ${reason}`)
  }
}

export interface RevisionItemDto { id: string; topicId: string; topicName: string; subjectId: string; subjectName: string; reason: string; score: number; createdAt: string }

export async function listActiveRevisions(userId: string): Promise<RevisionItemDto[]> {
  const rows = await db
    .select({
      id: revisionRecommendations.id, topicId: topics.id, topicName: topics.name, subjectId: subjects.id, subjectName: subjects.name,
      reason: revisionRecommendations.reason, score: revisionRecommendations.score, createdAt: revisionRecommendations.createdAt,
    })
    .from(revisionRecommendations)
    .innerJoin(topics, eq(topics.id, revisionRecommendations.topicId))
    .innerJoin(subjects, eq(subjects.id, topics.subjectId))
    .where(and(eq(revisionRecommendations.userId, userId), eq(revisionRecommendations.status, 'ACTIVE')))
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })).sort((a, b) => b.score - a.score)
}

export async function dismissRevision(userId: string, id: string): Promise<boolean> {
  const updated = await db
    .update(revisionRecommendations)
    .set({ status: 'DISMISSED', resolvedAt: new Date() })
    .where(and(eq(revisionRecommendations.id, id), eq(revisionRecommendations.userId, userId), eq(revisionRecommendations.status, 'ACTIVE')))
    .returning({ id: revisionRecommendations.id })
  return updated.length > 0
}
