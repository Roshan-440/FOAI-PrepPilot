import request from 'supertest'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { schema, db } from '../server/db/client'
import { resetDb, signedUpAgent } from './helpers'

beforeEach(resetDb)

async function makeTopic(agent: request.Agent) {
  const s = (await agent.post('/api/subjects').send({ name: 'DBMS', importance: 4 })).body.subject
  const t = (await agent.post(`/api/subjects/${s.id}/topics`).send({ name: 'Normalization' })).body.topic
  return { subject: s, topic: t }
}

describe('quiz system', () => {
  it('generates a topic quiz without leaking correct answers, then scores it correctly on submit', async () => {
    const { agent } = await signedUpAgent()
    const { topic } = await makeTopic(agent)

    const started = await agent.post('/api/quizzes').send({ sourceType: 'TOPIC', topicId: topic.id, count: 6 })
    expect(started.status).toBe(201)
    expect(started.body.quiz.status).toBe('IN_PROGRESS')
    expect(started.body.quiz.questions).toHaveLength(6)
    for (const q of started.body.quiz.questions) {
      expect(q.correctAnswer).toBeUndefined()
      expect(q.explanation).toBeUndefined()
    }

    // Peek the real correct answers from the DB, the way an honest test-taker's brain would know them.
    const dbQuestions = await db.select().from(schema.quizQuestions).where(eq(schema.quizQuestions.topicId, topic.id))
    const answers = dbQuestions.map((q) => ({ questionId: q.id, answer: q.correctAnswer }))

    const submitted = await agent.post(`/api/quizzes/${started.body.quiz.id}/submit`).send({ answers })
    expect(submitted.status).toBe(200)
    expect(submitted.body.quiz.status).toBe('SUBMITTED')
    expect(submitted.body.quiz.score).toBe(100)
    expect(submitted.body.quiz.correctCount).toBe(6)
    expect(submitted.body.quiz.questions[0].correctAnswer).toBeDefined()

    // Double submission is rejected, not silently re-scored.
    const again = await agent.post(`/api/quizzes/${started.body.quiz.id}/submit`).send({ answers })
    expect(again.status).toBe(409)

    // The topic's tracked score reflects the real result.
    const detail = await agent.get(`/api/subjects/${topic.subjectId}`)
    expect(detail.body.topics[0].lastScore).toBe(100)
  })

  it('scores wrong answers as wrong and computes a proportional score', async () => {
    const { agent } = await signedUpAgent()
    const { topic } = await makeTopic(agent)
    const started = await agent.post('/api/quizzes').send({ sourceType: 'TOPIC', topicId: topic.id, count: 4 })
    const answers = started.body.quiz.questions.map((q: { id: string }) => ({ questionId: q.id, answer: 'definitely wrong answer xyz' }))
    const submitted = await agent.post(`/api/quizzes/${started.body.quiz.id}/submit`).send({ answers })
    expect(submitted.body.quiz.score).toBeLessThan(100)
    expect(submitted.body.quiz.weakTopics.length).toBeGreaterThan(0)
  })

  it('rejects an invalid quiz request and requires topicId for a TOPIC quiz', async () => {
    const { agent } = await signedUpAgent()
    expect((await agent.post('/api/quizzes').send({ sourceType: 'TOPIC' })).status).toBe(400)
    expect((await agent.post('/api/quizzes').send({ sourceType: 'MIXED' })).status).toBe(400) // no topics exist yet
  })

  it('never lets one user access or submit to another user\'s quiz', async () => {
    const alice = await signedUpAgent()
    const bob = await signedUpAgent()
    const { topic } = await makeTopic(alice.agent)
    const quiz = (await alice.agent.post('/api/quizzes').send({ sourceType: 'TOPIC', topicId: topic.id, count: 3 })).body.quiz

    expect((await bob.agent.get(`/api/quizzes/${quiz.id}`)).status).toBe(404)
    expect((await bob.agent.post(`/api/quizzes/${quiz.id}/submit`).send({ answers: [{ questionId: quiz.questions[0].id, answer: 'x' }] })).status).toBe(404)
    expect((await bob.agent.post('/api/quizzes').send({ sourceType: 'TOPIC', topicId: topic.id, count: 3 })).status).toBe(404)
  })

  it('lists quiz history for the authenticated user only', async () => {
    const { agent } = await signedUpAgent()
    const { topic } = await makeTopic(agent)
    await agent.post('/api/quizzes').send({ sourceType: 'TOPIC', topicId: topic.id, count: 3 })
    const list = await agent.get('/api/quizzes')
    expect(list.body.quizzes).toHaveLength(1)
  })
})
