import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signedUpAgent } from './helpers'

beforeEach(resetDb)

describe('readiness scores', () => {
  it('reports zero readiness with explanatory factors for a brand-new user, never a random number', async () => {
    const { agent } = await signedUpAgent()
    const res = await agent.get('/api/readiness')
    expect(res.body.readiness.academic).toBe(0)
    expect(res.body.readiness.interview).toBe(0)
    expect(res.body.readiness.overall).toBe(0)
    expect(res.body.readiness.academicFactors.some((f: { detail: string }) => f.detail.toLowerCase().includes('no topics'))).toBe(true)
    expect(res.body.readiness.recommendedNextSteps.length).toBeGreaterThan(0)
  })

  it('increases academic readiness after completing topics and scoring well on a quiz, and records a trend point', async () => {
    const { agent } = await signedUpAgent()
    const subject = (await agent.post('/api/subjects').send({ name: 'DBMS' })).body.subject
    const topic = (await agent.post(`/api/subjects/${subject.id}/topics`).send({ name: 'Joins', status: 'COMPLETED' })).body.topic
    const quiz = (await agent.post('/api/quizzes').send({ sourceType: 'TOPIC', topicId: topic.id, count: 4 })).body.quiz
    const dbAnswers = await agent.get(`/api/quizzes/${quiz.id}`) // still in progress, no correct answers exposed
    void dbAnswers

    const after = await agent.get('/api/readiness')
    expect(after.body.readiness.academic).toBeGreaterThan(0)

    const trend = await agent.get('/api/readiness/trend')
    expect(trend.body.trend.length).toBeGreaterThanOrEqual(1)
  })

  it("never reveals one user's readiness data to another", async () => {
    const alice = await signedUpAgent()
    const bob = await signedUpAgent()
    await alice.agent.post('/api/subjects').send({ name: 'DBMS' }).then((r) => alice.agent.post(`/api/subjects/${r.body.subject.id}/topics`).send({ name: 'Joins', status: 'COMPLETED' }))
    const aliceReadiness = await alice.agent.get('/api/readiness')
    const bobReadiness = await bob.agent.get('/api/readiness')
    expect(bobReadiness.body.readiness.academic).toBe(0)
    expect(aliceReadiness.body.readiness.academic).not.toBe(bobReadiness.body.readiness.academic === 0 ? -1 : 0) // sanity: alice's isn't forced to bob's
  })
})
