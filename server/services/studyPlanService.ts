import { and, eq, or, sql } from 'drizzle-orm'
import { generateStudyPlan, type PlannerTopic, type PriorityLevel, type TaskType } from '../../shared/planner'
import type { StudyPlanDto, StudyTaskDto } from '../../shared/plan'
import { db, schema } from '../db/client'
import { badRequest, notFound } from '../utils/errors'
import { notify } from './notificationService'
import { getPrioritizedTopics } from './priorityService'

const { studyPlans, studyTasks, studySessions, subjects, topics, profiles } = schema

async function currentDateBudapest(): Promise<Date> {
  return new Date()
}

export async function generateAndSavePlan(userId: string, input: { startDate: string; endDate: string; hoursPerDay: number; studyDays: number[]; subjectIds?: string[]; goal?: string }): Promise<StudyPlanDto> {
  const [prioritized, [profile]] = await Promise.all([
    getPrioritizedTopics(userId, await currentDateBudapest()),
    db.select({ interviewDate: profiles.interviewDate }).from(profiles).where(eq(profiles.userId, userId)),
  ])

  const scoped = input.subjectIds && input.subjectIds.length > 0 ? prioritized.filter((p) => input.subjectIds!.includes(p.subjectId)) : prioritized
  if (scoped.length === 0) throw badRequest('Add subjects and topics before generating a study plan.')

  const plannerTopics: PlannerTopic[] = scoped.map((p) => ({
    topicId: p.topicId, subjectId: p.subjectId, subjectName: p.subjectName, topicName: p.topicName, status: p.status,
    difficulty: 'INTERMEDIATE', interviewRelevance: 3, lastScore: null, priorityScore: p.score, priorityLevel: p.level as PriorityLevel,
    recommendedMinutes: p.recommendedMinutes, reasons: p.reasons,
  }))

  const result = generateStudyPlan({
    startDate: input.startDate, endDate: input.endDate, hoursPerDay: input.hoursPerDay, studyDays: [...new Set(input.studyDays)],
    topics: plannerTopics, includeInterviewPractice: !!profile?.interviewDate,
  })

  return db.transaction(async (tx) => {
    // Archive any existing active plan so a student always has exactly one live schedule to follow.
    await tx.update(studyPlans).set({ status: 'ARCHIVED' }).where(and(eq(studyPlans.userId, userId), eq(studyPlans.status, 'ACTIVE')))

    const [plan] = await tx
      .insert(studyPlans)
      .values({ userId, title: input.goal?.trim() || 'Study Plan', goal: input.goal?.trim() || null, startDate: input.startDate, endDate: input.endDate, hoursPerDay: input.hoursPerDay, studyDays: input.studyDays, subjectIds: input.subjectIds ?? [], warnings: result.warnings })
      .returning()
    if (!plan) throw new Error('Failed to create study plan')

    if (result.tasks.length > 0) {
      await tx.insert(studyTasks).values(
        result.tasks.map((t) => ({
          userId, planId: plan.id, subjectId: t.subjectId, topicId: t.topicId, date: t.date, startMinute: t.startMinute,
          durationMinutes: t.durationMinutes, type: t.type as TaskType, priority: t.priority, reason: t.reason,
        })),
      )
    }
    return getPlanDetail(userId, plan.id, tx as unknown as typeof db)
  })
}

function toTaskDto(row: typeof studyTasks.$inferSelect, subjectName: string | null, topicName: string | null): StudyTaskDto {
  return {
    id: row.id, date: row.date, startMinute: row.startMinute, durationMinutes: row.durationMinutes, type: row.type,
    priority: row.priority, reason: row.reason, status: row.status, subjectId: row.subjectId, subjectName, topicId: row.topicId, topicName,
    completedAt: row.completedAt?.toISOString() ?? null,
  }
}

export async function getPlanDetail(userId: string, planId: string, conn: typeof db = db): Promise<StudyPlanDto> {
  const [plan] = await conn.select().from(studyPlans).where(and(eq(studyPlans.id, planId), eq(studyPlans.userId, userId)))
  if (!plan) throw notFound('Study plan not found.')
  const rows = await conn
    .select({ task: studyTasks, subjectName: subjects.name, topicName: topics.name })
    .from(studyTasks)
    .leftJoin(subjects, eq(subjects.id, studyTasks.subjectId))
    .leftJoin(topics, eq(topics.id, studyTasks.topicId))
    .where(eq(studyTasks.planId, planId))
    .orderBy(studyTasks.date, studyTasks.startMinute)
  return {
    id: plan.id, title: plan.title, goal: plan.goal, startDate: plan.startDate, endDate: plan.endDate, hoursPerDay: plan.hoursPerDay,
    studyDays: plan.studyDays, status: plan.status, warnings: plan.warnings, createdAt: plan.createdAt.toISOString(),
    tasks: rows.map((r) => toTaskDto(r.task, r.subjectName, r.topicName)),
  }
}

export async function getActivePlan(userId: string): Promise<StudyPlanDto | null> {
  const [plan] = await db.select({ id: studyPlans.id }).from(studyPlans).where(and(eq(studyPlans.userId, userId), eq(studyPlans.status, 'ACTIVE')))
  return plan ? getPlanDetail(userId, plan.id) : null
}

/** Marks a task complete, logs the time as a study session (so real hours/streaks can be measured), and — for a
 *  LEARN task on a NOT_STARTED topic — nudges the topic to IN_PROGRESS. Real signal, not fabricated mastery. */
export async function completeTask(userId: string, taskId: string): Promise<StudyTaskDto> {
  const [task] = await db.select().from(studyTasks).where(and(eq(studyTasks.id, taskId), eq(studyTasks.userId, userId)))
  if (!task) throw notFound('Task not found.')
  const [updated] = await db.update(studyTasks).set({ status: 'COMPLETED', completedAt: sql`now()` }).where(eq(studyTasks.id, taskId)).returning()
  await db.insert(studySessions).values({ userId, taskId: task.id, topicId: task.topicId, studiedOn: task.date, durationMinutes: task.durationMinutes })
  if (task.type === 'LEARN' && task.topicId) {
    await db.update(topics).set({ status: 'IN_PROGRESS', lastStudiedAt: sql`now()` }).where(and(eq(topics.id, task.topicId), eq(topics.userId, userId), eq(topics.status, 'NOT_STARTED')))
  }
  const [subjectName] = task.subjectId ? await db.select({ n: subjects.name }).from(subjects).where(eq(subjects.id, task.subjectId)) : [undefined]
  const [topicName] = task.topicId ? await db.select({ n: topics.name }).from(topics).where(eq(topics.id, task.topicId)) : [undefined]
  return toTaskDto(updated as typeof studyTasks.$inferSelect, subjectName?.n ?? null, topicName?.n ?? null)
}

export async function skipTask(userId: string, taskId: string): Promise<StudyTaskDto> {
  const [updated] = await db.update(studyTasks).set({ status: 'SKIPPED' }).where(and(eq(studyTasks.id, taskId), eq(studyTasks.userId, userId))).returning()
  if (!updated) throw notFound('Task not found.')
  const [subjectName] = updated.subjectId ? await db.select({ n: subjects.name }).from(subjects).where(eq(subjects.id, updated.subjectId)) : [undefined]
  const [topicName] = updated.topicId ? await db.select({ n: topics.name }).from(topics).where(eq(topics.id, updated.topicId)) : [undefined]
  return toTaskDto(updated, subjectName?.n ?? null, topicName?.n ?? null)
}

/**
 * Adaptive rescheduling: any PENDING task whose date has passed is marked MISSED, and — if its plan is still
 * active and within its date range — a replacement task is inserted on the next available day that still has
 * spare capacity, protecting the plan's end date rather than silently overloading a single day.
 */
export async function rescheduleMissedTasks(userId: string, today: Date = new Date()): Promise<number> {
  const todayIso = today.toISOString().slice(0, 10)
  const overdue = await db
    .select({ task: studyTasks, plan: studyPlans })
    .from(studyTasks)
    .innerJoin(studyPlans, eq(studyPlans.id, studyTasks.planId))
    .where(and(eq(studyTasks.userId, userId), eq(studyTasks.status, 'PENDING'), eq(studyPlans.status, 'ACTIVE'), sql`${studyTasks.date} < ${todayIso}`))
  if (overdue.length === 0) return 0

  let rescheduled = 0
  for (const { task, plan } of overdue) {
    await db.update(studyTasks).set({ status: 'MISSED' }).where(eq(studyTasks.id, task.id))
    if (plan.endDate < todayIso) continue // the plan window is over — protect the deadline rather than push tasks past it

    // Find the next day in range with spare capacity.
    const dayBudget = Math.round(plan.hoursPerDay * 60)
    const candidateDates = enumerateDates(todayIso, plan.endDate, plan.studyDays)
    for (const date of candidateDates) {
      const usedRows = await db.select({ used: sql<number>`coalesce(sum(${studyTasks.durationMinutes}), 0)::int` }).from(studyTasks).where(and(eq(studyTasks.planId, plan.id), eq(studyTasks.date, date), or(eq(studyTasks.status, 'PENDING'), eq(studyTasks.status, 'COMPLETED'))))
      const remaining = dayBudget - (usedRows[0]?.used ?? 0)
      if (remaining >= Math.min(task.durationMinutes, 20)) {
        const duration = Math.min(task.durationMinutes, remaining)
        const cursorRows = await db.select({ cursor: sql<number>`coalesce(max(${studyTasks.startMinute} + ${studyTasks.durationMinutes}), 1080)::int` }).from(studyTasks).where(and(eq(studyTasks.planId, plan.id), eq(studyTasks.date, date)))
        const cursor = cursorRows[0]?.cursor ?? 1080
        await db.insert(studyTasks).values({ userId, planId: plan.id, subjectId: task.subjectId, topicId: task.topicId, date, startMinute: cursor, durationMinutes: duration, type: task.type, priority: task.priority, reason: `Rescheduled from ${task.date} (missed).` })
        const [topicName] = task.topicId ? await db.select({ n: topics.name }).from(topics).where(eq(topics.id, task.topicId)) : [undefined]
        await notify(userId, 'TASK_RESCHEDULED', 'Task rescheduled', `${topicName?.n ?? task.type} moved from ${task.date} to ${date} after being missed.`)
        rescheduled += 1
        break
      }
    }
  }
  return rescheduled
}

function enumerateDates(start: string, end: string, studyDays: number[]): string[] {
  const dates: string[] = []
  const cursor = new Date(`${start}T00:00:00Z`)
  const endDate = new Date(`${end}T00:00:00Z`)
  const allowed = new Set(studyDays)
  while (cursor.getTime() <= endDate.getTime()) {
    const iso = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay()
    if (allowed.has(iso)) dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

export interface StudyStatsDto { todayMinutes: number; streakDays: number }

/** Streak = number of consecutive days, counting back from today, with at least one logged study session. Computed from real completed tasks only — never estimated or randomized. */
export async function getStudyStats(userId: string, today: Date = new Date()): Promise<StudyStatsDto> {
  const todayIso = today.toISOString().slice(0, 10)
  const rows = await db
    .select({ studiedOn: studySessions.studiedOn, minutes: sql<number>`sum(${studySessions.durationMinutes})::int` })
    .from(studySessions)
    .where(eq(studySessions.userId, userId))
    .groupBy(studySessions.studiedOn)
  const minutesByDate = new Map(rows.map((r) => [r.studiedOn, r.minutes]))

  let streakDays = 0
  const cursor = new Date(`${todayIso}T00:00:00Z`)
  // A day with zero logged minutes breaks the streak, except we don't require today itself to already have activity.
  while (true) {
    const iso = cursor.toISOString().slice(0, 10)
    const minutes = minutesByDate.get(iso) ?? 0
    if (minutes > 0) {
      streakDays += 1
    } else if (iso !== todayIso) {
      break
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1)
    if (streakDays > 365) break // safety valve
  }

  return { todayMinutes: minutesByDate.get(todayIso) ?? 0, streakDays }
}
