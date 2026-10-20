import { beforeEach, describe, expect, it } from 'vitest'
import { db, schema } from '../server/db/client'
import { resetDb, signedUpAgent } from './helpers'

beforeEach(resetDb)

function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}
function futureIso(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

describe('study stats & streak', () => {
  it('reports zero stats for a brand-new user', async () => {
    const { agent } = await signedUpAgent()
    const res = await agent.get('/api/stats/today')
    expect(res.body.stats).toEqual({ todayMinutes: 0, streakDays: 0 })
  })

  it("logs a real study session and today's minutes when a task is completed", async () => {
    const { agent } = await signedUpAgent()
    const subject = (await agent.post('/api/subjects').send({ name: 'DS' })).body.subject
    await agent.post(`/api/subjects/${subject.id}/topics`).send({ name: 'Trees', estimatedMinutes: 45 })
    const plan = (await agent.post('/api/plan').send({ startDate: futureIso(0), endDate: futureIso(5), hoursPerDay: 2, studyDays: [1, 2, 3, 4, 5, 6, 7] })).body.plan
    const learnTask = plan.tasks.find((t: { type: string; date: string }) => t.type === 'LEARN' && t.date === futureIso(0))
    expect(learnTask).toBeDefined()

    await agent.post(`/api/plan/tasks/${learnTask.id}/complete`)
    const stats = await agent.get('/api/stats/today')
    expect(stats.body.stats.todayMinutes).toBe(learnTask.durationMinutes)
    expect(stats.body.stats.streakDays).toBeGreaterThanOrEqual(1)
  })

  it('computes a multi-day streak from real logged sessions and breaks on a gap', async () => {
    const { agent, user } = await signedUpAgent()
    // Simulate 3 consecutive days of real study activity (today, yesterday, the day before), then a gap.
    await db.insert(schema.studySessions).values([
      { userId: user.id, topicId: null, taskId: null, studiedOn: isoDaysAgo(0), durationMinutes: 30 },
      { userId: user.id, topicId: null, taskId: null, studiedOn: isoDaysAgo(1), durationMinutes: 40 },
      { userId: user.id, topicId: null, taskId: null, studiedOn: isoDaysAgo(2), durationMinutes: 50 },
      { userId: user.id, topicId: null, taskId: null, studiedOn: isoDaysAgo(4), durationMinutes: 20 }, // gap at day 3 breaks the streak
    ])
    const res = await agent.get('/api/stats/today')
    expect(res.body.stats.todayMinutes).toBe(30)
    expect(res.body.stats.streakDays).toBe(3)
  })

  it("never reveals one user's study stats to another", async () => {
    const alice = await signedUpAgent()
    const bob = await signedUpAgent()
    await db.insert(schema.studySessions).values({ userId: alice.user.id, topicId: null, taskId: null, studiedOn: isoDaysAgo(0), durationMinutes: 60 })
    expect((await alice.agent.get('/api/stats/today')).body.stats.todayMinutes).toBe(60)
    expect((await bob.agent.get('/api/stats/today')).body.stats.todayMinutes).toBe(0)
  })
})
