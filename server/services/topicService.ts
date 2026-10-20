import { and, asc, eq, sql } from 'drizzle-orm'
import type { TopicDto, TopicInput } from '../../shared/academics'
import { db, schema } from '../db/client'
import { conflict, notFound, pgErrorCode } from '../utils/errors'

const { topics, subjects } = schema
type TopicRow = typeof topics.$inferSelect

const DUPLICATE_TOPIC = () => conflict('This subject already has a topic with that name.', 'DUPLICATE', { name: 'This subject already has a topic with that name.' })

export function toTopicDto(r: TopicRow): TopicDto {
  return {
    id: r.id,
    subjectId: r.subjectId,
    name: r.name,
    description: r.description,
    difficulty: r.difficulty,
    importance: r.importance,
    interviewRelevance: r.interviewRelevance,
    estimatedMinutes: r.estimatedMinutes,
    status: r.status,
    confidence: r.confidence,
    lastStudiedAt: r.lastStudiedAt?.toISOString() ?? null,
    lastScore: r.lastScore,
  }
}

export async function listTopics(userId: string, subjectId?: string): Promise<TopicDto[]> {
  const where = subjectId ? and(eq(topics.userId, userId), eq(topics.subjectId, subjectId)) : eq(topics.userId, userId)
  const rows = await db.select().from(topics).where(where).orderBy(asc(topics.createdAt), asc(topics.name))
  return rows.map(toTopicDto)
}

export async function createTopic(userId: string, subjectId: string, input: TopicInput): Promise<TopicDto> {
  // The subject must belong to the caller, otherwise a client could attach topics to someone else's subject.
  const [owned] = await db.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
  if (!owned) throw notFound('Subject not found.')
  try {
    const [row] = await db
      .insert(topics)
      .values({
        userId,
        subjectId,
        name: input.name,
        description: input.description ?? null,
        difficulty: input.difficulty,
        importance: input.importance,
        interviewRelevance: input.interviewRelevance,
        estimatedMinutes: input.estimatedMinutes,
        status: input.status,
        confidence: input.confidence ?? null,
        lastStudiedAt: input.status === 'NOT_STARTED' ? null : new Date(),
      })
      .returning()
    return toTopicDto(row as TopicRow)
  } catch (err) {
    if (pgErrorCode(err) === '23505') throw DUPLICATE_TOPIC()
    throw err
  }
}

export async function updateTopic(userId: string, topicId: string, input: Partial<TopicInput>): Promise<TopicDto> {
  const patch: Partial<typeof topics.$inferInsert> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.description !== undefined) patch.description = input.description
  if (input.difficulty !== undefined) patch.difficulty = input.difficulty
  if (input.importance !== undefined) patch.importance = input.importance
  if (input.interviewRelevance !== undefined) patch.interviewRelevance = input.interviewRelevance
  if (input.estimatedMinutes !== undefined) patch.estimatedMinutes = input.estimatedMinutes
  if (input.confidence !== undefined) patch.confidence = input.confidence
  if (input.status !== undefined) {
    patch.status = input.status
    // Moving a topic forward counts as studying it today.
    if (input.status !== 'NOT_STARTED') patch.lastStudiedAt = new Date()
  }
  try {
    const [row] = await db
      .update(topics)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(and(eq(topics.id, topicId), eq(topics.userId, userId)))
      .returning()
    if (!row) throw notFound('Topic not found.')
    return toTopicDto(row)
  } catch (err) {
    if (pgErrorCode(err) === '23505') throw DUPLICATE_TOPIC()
    throw err
  }
}

export async function deleteTopic(userId: string, topicId: string): Promise<void> {
  const deleted = await db.delete(topics).where(and(eq(topics.id, topicId), eq(topics.userId, userId))).returning({ id: topics.id })
  if (deleted.length === 0) throw notFound('Topic not found.')
}
