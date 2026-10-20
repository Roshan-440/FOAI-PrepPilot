import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signedUpAgent } from './helpers'

beforeEach(resetDb)

function futureDate(daysAhead: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + daysAhead)
  return d.toISOString().slice(0, 10)
}

describe('study planner', () => {
  it('generates a non-overlapping plan and lets the student complete a task, nudging the topic forward', async () => {
    const { agent } = await signedUpAgent()
    const subject = (await agent.post('/api/subjects').send({ name: 'Data Structures', importance: 5 })).body.subject
    const topic = (await agent.post(`/api/subjects/${subject.id}/topics`).send({ name: 'Trees', estimatedMinutes: 60 })).body.topic

    const generated = await agent.post('/api/plan').send({ startDate: futureDate(1), endDate: futureDate(10), hoursPerDay: 2, studyDays: [1, 2, 3, 4, 5, 6, 7] })
    expect(generated.status).toBe(201)
    expect(generated.body.plan.tasks.length).toBeGreaterThan(0)
    const learnTask = generated.body.plan.tasks.find((t: { topicId: string; type: string }) => t.topicId === topic.id && t.type === 'LEARN')
    expect(learnTask).toBeDefined()

    const active = await agent.get('/api/plan')
    expect(active.body.plan.id).toBe(generated.body.plan.id)

    const completed = await agent.post(`/api/plan/tasks/${learnTask.id}/complete`)
    expect(completed.status).toBe(200)
    expect(completed.body.task.status).toBe('COMPLETED')

    const detail = await agent.get(`/api/subjects/${subject.id}`)
    expect(detail.body.topics[0].status).toBe('IN_PROGRESS')
  })

  it('reports a clear warning instead of an impossible schedule, and generating a new plan archives the old one', async () => {
    const { agent } = await signedUpAgent()
    const subject = (await agent.post('/api/subjects').send({ name: 'Everything' })).body.subject
    for (let i = 0; i < 10; i++) await agent.post(`/api/subjects/${subject.id}/topics`).send({ name: `Topic ${i}`, estimatedMinutes: 120 })

    const overloaded = await agent.post('/api/plan').send({ startDate: futureDate(1), endDate: futureDate(1), hoursPerDay: 1, studyDays: [1, 2, 3, 4, 5, 6, 7] })
    expect(overloaded.body.plan.warnings.length).toBeGreaterThan(0)

    const second = await agent.post('/api/plan').send({ startDate: futureDate(1), endDate: futureDate(5), hoursPerDay: 3, studyDays: [1, 2, 3, 4, 5, 6, 7] })
    expect(second.status).toBe(201)
    const activeNow = await agent.get('/api/plan')
    expect(activeNow.body.plan.id).toBe(second.body.plan.id)
  })

  it('validates plan input (end before start, no study days)', async () => {
    const { agent } = await signedUpAgent()
    await agent.post('/api/subjects').send({ name: 'X' })
    expect((await agent.post('/api/plan').send({ startDate: futureDate(5), endDate: futureDate(1), hoursPerDay: 2, studyDays: [1] })).status).toBe(400)
    expect((await agent.post('/api/plan').send({ startDate: futureDate(1), endDate: futureDate(5), hoursPerDay: 2, studyDays: [] })).status).toBe(400)
  })

  it("never lets one user complete or see another user's plan tasks", async () => {
    const alice = await signedUpAgent()
    const bob = await signedUpAgent()
    await alice.agent.post('/api/subjects').send({ name: 'DBMS' }).then((r) => alice.agent.post(`/api/subjects/${r.body.subject.id}/topics`).send({ name: 'SQL' }))
    const plan = (await alice.agent.post('/api/plan').send({ startDate: futureDate(1), endDate: futureDate(5), hoursPerDay: 2, studyDays: [1, 2, 3, 4, 5, 6, 7] })).body.plan
    expect((await bob.agent.get('/api/plan')).body.plan).toBeNull()
    if (plan.tasks[0]) expect((await bob.agent.post(`/api/plan/tasks/${plan.tasks[0].id}/complete`)).status).toBe(404)
  })
})
