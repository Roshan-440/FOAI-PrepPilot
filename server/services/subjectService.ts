import { and, desc, eq, sql } from 'drizzle-orm'
import type { SubjectDto, SubjectInput, TopicDto } from '../../shared/academics'
import { db, schema } from '../db/client'
import { conflict, notFound, pgErrorCode } from '../utils/errors'

const { subjects, topics } = schema

const DUPLICATE_SUBJECT = () => conflict('You already have a subject with that name.', 'DUPLICATE', { name: 'You already have a subject with that name.' })

const subjectSelect = {
  id: subjects.id,
  name: subjects.name,
  description: subjects.description,
  importance: subjects.importance,
  examDate: subjects.examDate,
  color: subjects.color,
  topicCount: sql<number>`count(${topics.id})::int`,
  completedCount: sql<number>`count(${topics.id}) filter (where ${topics.status} = 'COMPLETED')::int`,
}

function toDto(r: { id: string; name: string; description: string | null; importance: number; examDate: string | null; color: string; topicCount: number; completedCount: number }): SubjectDto {
  return { ...r, completionPercent: r.topicCount === 0 ? 0 : Math.round((r.completedCount / r.topicCount) * 100) }
}

export async function listSubjects(userId: string): Promise<SubjectDto[]> {
  const rows = await db
    .select(subjectSelect)
    .from(subjects)
    .leftJoin(topics, eq(topics.subjectId, subjects.id))
    .where(eq(subjects.userId, userId))
    .groupBy(subjects.id)
    .orderBy(desc(subjects.importance), subjects.name)
  return rows.map(toDto)
}

/** Returns the subject only if it belongs to `userId`; otherwise 404 (never reveals that it exists). */
export async function getSubject(userId: string, subjectId: string): Promise<SubjectDto> {
  const [row] = await db
    .select(subjectSelect)
    .from(subjects)
    .leftJoin(topics, eq(topics.subjectId, subjects.id))
    .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
    .groupBy(subjects.id)
  if (!row) throw notFound('Subject not found.')
  return toDto(row)
}

export async function createSubject(userId: string, input: SubjectInput): Promise<SubjectDto> {
  try {
    const [row] = await db
      .insert(subjects)
      .values({ userId, name: input.name, description: input.description ?? null, importance: input.importance, examDate: input.examDate ?? null, color: input.color })
      .returning({ id: subjects.id })
    return getSubject(userId, (row as { id: string }).id)
  } catch (err) {
    if (pgErrorCode(err) === '23505') throw DUPLICATE_SUBJECT()
    throw err
  }
}

export async function updateSubject(userId: string, subjectId: string, input: Partial<SubjectInput>): Promise<SubjectDto> {
  const patch: Partial<typeof subjects.$inferInsert> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.description !== undefined) patch.description = input.description
  if (input.importance !== undefined) patch.importance = input.importance
  if (input.examDate !== undefined) patch.examDate = input.examDate
  if (input.color !== undefined) patch.color = input.color
  try {
    const updated = await db
      .update(subjects)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
      .returning({ id: subjects.id })
    if (updated.length === 0) throw notFound('Subject not found.')
  } catch (err) {
    if (pgErrorCode(err) === '23505') throw DUPLICATE_SUBJECT()
    throw err
  }
  return getSubject(userId, subjectId)
}

export async function deleteSubject(userId: string, subjectId: string): Promise<void> {
  const deleted = await db.delete(subjects).where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId))).returning({ id: subjects.id })
  if (deleted.length === 0) throw notFound('Subject not found.')
}

export type { TopicDto }
