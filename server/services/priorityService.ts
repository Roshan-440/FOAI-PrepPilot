import { eq } from 'drizzle-orm'
import { computeTopicPriority, estimateStudyMinutes, type PriorityFactorInput, type PriorityResult } from '../../shared/priority'
import { db, schema } from '../db/client'

const { topics, subjects, profiles } = schema

export interface PrioritizedTopic extends PriorityResult {
  topicId: string
  topicName: string
  subjectId: string
  subjectName: string
  status: (typeof topics.$inferSelect)['status']
  estimatedMinutes: number
  recommendedMinutes: number
}

function daysUntil(dateStr: string | null, today: Date): number | null {
  if (!dateStr) return null
  const target = new Date(`${dateStr}T00:00:00Z`)
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const diffMs = target.getTime() - start.getTime()
  const days = Math.round(diffMs / 86_400_000)
  return days < 0 ? null : days // a past deadline no longer drives urgency
}

/** Every incomplete-or-weak topic for the student, ranked by the deterministic priority score, most urgent first. */
export async function getPrioritizedTopics(userId: string, today: Date = new Date()): Promise<PrioritizedTopic[]> {
  const [rows, [profile]] = await Promise.all([
    db
      .select({
        id: topics.id, name: topics.name, status: topics.status, importance: topics.importance,
        interviewRelevance: topics.interviewRelevance, confidence: topics.confidence, lastScore: topics.lastScore,
        estimatedMinutes: topics.estimatedMinutes, difficulty: topics.difficulty,
        subjectId: subjects.id, subjectName: subjects.name, subjectExamDate: subjects.examDate,
      })
      .from(topics)
      .innerJoin(subjects, eq(subjects.id, topics.subjectId))
      .where(eq(topics.userId, userId)),
    db.select({ examDate: profiles.examDate, interviewDate: profiles.interviewDate }).from(profiles).where(eq(profiles.userId, userId)),
  ])

  const results = rows.map((r): PrioritizedTopic => {
    const input: PriorityFactorInput = {
      status: r.status,
      importance: r.importance,
      interviewRelevance: r.interviewRelevance,
      confidence: r.confidence,
      lastScore: r.lastScore,
      daysUntilExam: daysUntil(r.subjectExamDate ?? profile?.examDate ?? null, today),
      daysUntilInterview: daysUntil(profile?.interviewDate ?? null, today),
    }
    const priority = computeTopicPriority(input)
    return {
      ...priority,
      topicId: r.id, topicName: r.name, subjectId: r.subjectId, subjectName: r.subjectName, status: r.status,
      estimatedMinutes: r.estimatedMinutes, recommendedMinutes: estimateStudyMinutes(r.estimatedMinutes, priority.level, r.difficulty),
    }
  })

  return results.sort((a, b) => b.score - a.score)
}
