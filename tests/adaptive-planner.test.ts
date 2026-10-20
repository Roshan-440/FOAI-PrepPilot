import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, schema } from '../server/db/client'
import { resetDb, signedUpAgent } from './helpers'

beforeEach(resetDb)

function isoDaysFromToday(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

describe('adaptive rescheduling of missed tasks', () => {
  it('marks an overdue pending task as MISSED and reschedules it into the plan window with spare capacity', async () => {
    const { agent, user } = await signedUpAgent()
    const subject = (await agent.post('/api/subjects').send({ name: 'DBMS', importance: 5 })).body.subject
    const topic = (await agent.post(`/api/subjects/${subject.id}/topics`).send({ name: 'Transactions', estimatedMinutes: 40 })).body.topic

    const [plan] = await db.insert(schema.studyPlans).values({
      userId: user.id, title: 'Study Plan', startDate: isoDaysFromToday(-5), endDate: isoDaysFromToday(5),
      hoursPerDay: 2, studyDays: [1, 2, 3, 4, 5, 6, 7], status: 'ACTIVE',
    }).returning()
    if (!plan) throw new Error('setup failed')

    const [missedTask] = await db.insert(schema.studyTasks).values({
      userId: user.id, planId: plan.id, subjectId: subject.id, topicId: topic.id,
      date: isoDaysFromToday(-1), startMinute: 1080, durationMinutes: 40, type: 'LEARN', priority: 'HIGH',
      reason: 'Topic has not been started yet', status: 'PENDING',
    }).returning()
    if (!missedTask) throw new Error('setup failed')

    // GET /plan triggers the adaptive reschedule pass as a side effect.
    const res = await agent.get('/api/plan')
    expect(res.status).toBe(200)

    const [reloaded] = await db.select().from(schema.studyTasks).where(eq(schema.studyTasks.id, missedTask.id))
    expect(reloaded?.status).toBe('MISSED')

    const replacement = res.body.plan.tasks.find(
      (t: { topicId: string; type: string; status: string }) => t.topicId === topic.id && t.type === 'LEARN' && t.status === 'PENDING',
    )
    expect(replacement).toBeDefined()
    expect(replacement.reason).toMatch(/Rescheduled from/)
    expect(replacement.date >= isoDaysFromToday(0)).toBe(true)
    expect(replacement.date <= plan.endDate).toBe(true)
    expect(replacement.durationMinutes).toBeLessThanOrEqual(40)
  })

  it('never overloads the day it reschedules into, respecting the daily budget', async () => {
    const { agent, user } = await signedUpAgent()
    const subject = (await agent.post('/api/subjects').send({ name: 'OS' })).body.subject
    const topic = (await agent.post(`/api/subjects/${subject.id}/topics`).send({ name: 'Scheduling', estimatedMinutes: 50 })).body.topic

    const [plan] = await db.insert(schema.studyPlans).values({
      userId: user.id, title: 'Study Plan', startDate: isoDaysFromToday(-3), endDate: isoDaysFromToday(3),
      hoursPerDay: 1, studyDays: [1, 2, 3, 4, 5, 6, 7], status: 'ACTIVE',
    }).returning()
    if (!plan) throw new Error('setup failed')

    // Today is already nearly full (55 of the 60-minute budget used).
    await db.insert(schema.studyTasks).values({
      userId: user.id, planId: plan.id, subjectId: subject.id, topicId: null,
      date: isoDaysFromToday(0), startMinute: 1080, durationMinutes: 55, type: 'QUIZ', priority: 'MEDIUM', reason: 'existing', status: 'PENDING',
    })
    await db.insert(schema.studyTasks).values({
      userId: user.id, planId: plan.id, subjectId: subject.id, topicId: topic.id,
      date: isoDaysFromToday(-1), startMinute: 1080, durationMinutes: 50, type: 'LEARN', priority: 'HIGH', reason: 'missed', status: 'PENDING',
    })

    await agent.get('/api/plan')

    const dayZeroTasks = await db.select().from(schema.studyTasks).where(and(eq(schema.studyTasks.planId, plan.id), eq(schema.studyTasks.date, isoDaysFromToday(0))))
    const totalMinutesToday = dayZeroTasks.filter((t) => t.status !== 'MISSED').reduce((s, t) => s + t.durationMinutes, 0)
    expect(totalMinutesToday).toBeLessThanOrEqual(60)
  })

  it("protects the plan's deadline: a missed task from an already-ended plan is marked MISSED with no replacement", async () => {
    const { agent, user } = await signedUpAgent()
    const subject = (await agent.post('/api/subjects').send({ name: 'CN' })).body.subject
    const topic = (await agent.post(`/api/subjects/${subject.id}/topics`).send({ name: 'Routing' })).body.topic

    const [endedPlan] = await db.insert(schema.studyPlans).values({
      userId: user.id, title: 'Old Plan', startDate: isoDaysFromToday(-10), endDate: isoDaysFromToday(-2),
      hoursPerDay: 2, studyDays: [1, 2, 3, 4, 5, 6, 7], status: 'ACTIVE',
    }).returning()
    if (!endedPlan) throw new Error('setup failed')
    const [oldTask] = await db.insert(schema.studyTasks).values({
      userId: user.id, planId: endedPlan.id, subjectId: subject.id, topicId: topic.id,
      date: isoDaysFromToday(-3), startMinute: 1080, durationMinutes: 30, type: 'LEARN', priority: 'MEDIUM', reason: 'old', status: 'PENDING',
    }).returning()
    if (!oldTask) throw new Error('setup failed')

    await agent.get('/api/plan')

    const [reloaded] = await db.select().from(schema.studyTasks).where(eq(schema.studyTasks.id, oldTask.id))
    expect(reloaded?.status).toBe('MISSED')
    const allTasksForPlan = await db.select().from(schema.studyTasks).where(eq(schema.studyTasks.planId, endedPlan.id))
    expect(allTasksForPlan).toHaveLength(1) // no replacement was inserted anywhere for this expired plan
  })

  it("never reschedules or exposes another user's missed tasks", async () => {
    const alice = await signedUpAgent()
    const bob = await signedUpAgent()
    const subject = (await alice.agent.post('/api/subjects').send({ name: 'Algo' })).body.subject
    const topic = (await alice.agent.post(`/api/subjects/${subject.id}/topics`).send({ name: 'Sorting' })).body.topic
    const [plan] = await db.insert(schema.studyPlans).values({
      userId: alice.user.id, title: 'Plan', startDate: isoDaysFromToday(-5), endDate: isoDaysFromToday(5), hoursPerDay: 2, studyDays: [1, 2, 3, 4, 5, 6, 7], status: 'ACTIVE',
    }).returning()
    if (!plan) throw new Error('setup failed')
    await db.insert(schema.studyTasks).values({ userId: alice.user.id, planId: plan.id, subjectId: subject.id, topicId: topic.id, date: isoDaysFromToday(-1), startMinute: 1080, durationMinutes: 30, type: 'LEARN', priority: 'HIGH', reason: 'x', status: 'PENDING' })

    // Bob's own GET /plan must not touch or reveal Alice's overdue task.
    const bobPlan = await bob.agent.get('/api/plan')
    expect(bobPlan.body.plan).toBeNull()
    const aliceTasks = await db.select().from(schema.studyTasks).where(eq(schema.studyTasks.planId, plan.id))
    expect(aliceTasks.every((t) => t.status === 'PENDING')).toBe(true) // untouched by Bob's request
  })
})
