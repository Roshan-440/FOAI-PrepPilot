import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, schema } from '../server/db/client'
import { resetDb, signedUpAgent } from './helpers'

beforeEach(resetDb)

describe('revision engine', () => {
  it('recommends revision after a weak quiz score and lets the student dismiss it', async () => {
    const { agent } = await signedUpAgent()
    const subject = (await agent.post('/api/subjects').send({ name: 'OS', importance: 4 })).body.subject
    const topic = (await agent.post(`/api/subjects/${subject.id}/topics`).send({ name: 'Deadlocks' })).body.topic

    let rec = await agent.get('/api/revision')
    expect(rec.body.recommendations).toHaveLength(0)

    const started = (await agent.post('/api/quizzes').send({ sourceType: 'TOPIC', topicId: topic.id, count: 4 })).body.quiz
    await agent.post(`/api/quizzes/${started.id}/submit`).send({ answers: started.questions.map((q: { id: string }) => ({ questionId: q.id, answer: 'wrong' })) })

    rec = await agent.get('/api/revision')
    expect(rec.body.recommendations).toHaveLength(1)
    expect(rec.body.recommendations[0].topicId).toBe(topic.id)
    expect(rec.body.recommendations[0].reason).toMatch(/quiz score/)

    const dismissed = await agent.post(`/api/revision/${rec.body.recommendations[0].id}/dismiss`)
    expect(dismissed.status).toBe(204)
    rec = await agent.get('/api/revision')
    expect(rec.body.recommendations).toHaveLength(0)
  })

  it('recommends revision when a topic is explicitly marked NEEDS_REVISION, and clears it once resolved', async () => {
    const { agent } = await signedUpAgent()
    const subject = (await agent.post('/api/subjects').send({ name: 'CN' })).body.subject
    const topic = (await agent.post(`/api/subjects/${subject.id}/topics`).send({ name: 'TCP/IP' })).body.topic
    await agent.patch(`/api/topics/${topic.id}`).send({ status: 'NEEDS_REVISION' })
    let rec = await agent.get('/api/revision')
    expect(rec.body.recommendations).toHaveLength(1)

    await agent.patch(`/api/topics/${topic.id}`).send({ status: 'COMPLETED' })
    rec = await agent.get('/api/revision')
    expect(rec.body.recommendations).toHaveLength(0)
  })

  it("never lets one user see or dismiss another user's revision recommendations", async () => {
    const alice = await signedUpAgent()
    const bob = await signedUpAgent()
    const subject = (await alice.agent.post('/api/subjects').send({ name: 'Algorithms' })).body.subject
    const topic = (await alice.agent.post(`/api/subjects/${subject.id}/topics`).send({ name: 'Sorting', confidence: 1 })).body.topic
    await alice.agent.patch(`/api/topics/${topic.id}`).send({ status: 'NEEDS_REVISION' })
    const rec = (await alice.agent.get('/api/revision')).body.recommendations[0]

    expect((await bob.agent.get('/api/revision')).body.recommendations).toHaveLength(0)
    expect((await bob.agent.post(`/api/revision/${rec.id}/dismiss`)).status).toBe(404)
    const [row] = await db.select().from(schema.revisionRecommendations).where(eq(schema.revisionRecommendations.id, rec.id))
    expect(row?.status).toBe('ACTIVE')
  })
})
