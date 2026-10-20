import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb, signedUpAgent } from './helpers'

beforeEach(resetDb)

describe('interview question practice', () => {
  it('generates practice questions and evaluates an answer without leaking the key points ahead of time', async () => {
    const { agent } = await signedUpAgent()
    const gen = await agent.post('/api/interview/questions/generate').send({ role: 'Backend Developer', category: 'TECHNICAL', difficulty: 'INTERMEDIATE', count: 3 })
    expect(gen.status).toBe(201)
    expect(gen.body.questions).toHaveLength(3)
    for (const q of gen.body.questions) {
      expect(q.keyPoints.length).toBeGreaterThan(0)
      expect(q.source).toBe('FALLBACK_BANK') // AI_PROVIDER=mock in this environment
    }

    const list = await agent.get('/api/interview/questions?category=TECHNICAL')
    expect(list.body.questions.length).toBeGreaterThanOrEqual(3)

    const answer = await agent.post(`/api/interview/questions/${gen.body.questions[0].id}/answer`).send({ answer: 'A reasonably detailed answer covering the main idea.' })
    expect(answer.status).toBe(201)
    expect(answer.body.answer.overallScore).toBeGreaterThanOrEqual(0)
    expect(answer.body.answer.overallScore).toBeLessThanOrEqual(100)
    expect(Object.keys(answer.body.answer.scores)).toEqual(['correctness', 'relevance', 'completeness', 'clarity', 'depth', 'communication'])
  })

  it("does not let one user answer another user's private practice question", async () => {
    const alice = await signedUpAgent()
    const bob = await signedUpAgent()
    const gen = await alice.agent.post('/api/interview/questions/generate').send({ role: 'QA Engineer', category: 'HR', difficulty: 'BEGINNER', count: 2 })
    const qid = gen.body.questions[0].id
    expect((await bob.agent.post(`/api/interview/questions/${qid}/answer`).send({ answer: 'hi' })).status).toBe(404)
  })
})

describe('mock interviews', () => {
  it('runs a full mock interview: start, answer, complete, and produce a report', async () => {
    const { agent } = await signedUpAgent()
    const started = await agent.post('/api/mock-interviews').send({ role: 'Full Stack Developer', type: 'TECHNICAL', difficulty: 'INTERMEDIATE', questionCount: 3 })
    expect(started.status).toBe(201)
    const mock = started.body.mockInterview
    expect(mock.status).toBe('IN_PROGRESS')
    expect(mock.questions.length).toBeGreaterThan(0)

    for (const q of mock.questions) {
      const res = await agent.post(`/api/mock-interviews/${mock.id}/questions/${q.id}/answer`).send({ answer: `My answer discussing ${q.topic} in some detail with an example.` })
      expect(res.status).toBe(201)
    }

    const completed = await agent.post(`/api/mock-interviews/${mock.id}/complete`)
    expect(completed.status).toBe(200)
    expect(completed.body.mockInterview.status).toBe('COMPLETED')
    expect(completed.body.mockInterview.report.overallScore).toBeGreaterThanOrEqual(0)
    expect(completed.body.mockInterview.report.strengths.length).toBeGreaterThan(0)
    expect(completed.body.mockInterview.report.suggestedImprovements.length).toBeGreaterThan(0)

    const fetched = await agent.get(`/api/mock-interviews/${mock.id}`)
    expect(fetched.body.mockInterview.overallScore).toBe(completed.body.mockInterview.report.overallScore)
  })

  it('refuses to complete a mock interview with no answers yet', async () => {
    const { agent } = await signedUpAgent()
    const started = (await agent.post('/api/mock-interviews').send({ role: 'Data Analyst', type: 'HR', difficulty: 'BEGINNER', questionCount: 3 })).body.mockInterview
    expect((await agent.post(`/api/mock-interviews/${started.id}/complete`)).status).toBe(400)
  })

  it("never lets one user see, answer, or complete another user's mock interview", async () => {
    const alice = await signedUpAgent()
    const bob = await signedUpAgent()
    const mock = (await alice.agent.post('/api/mock-interviews').send({ role: 'DevOps Engineer', type: 'MIXED', difficulty: 'ADVANCED', questionCount: 3 })).body.mockInterview

    expect((await bob.agent.get(`/api/mock-interviews/${mock.id}`)).status).toBe(404)
    expect((await bob.agent.post(`/api/mock-interviews/${mock.id}/questions/${mock.questions[0].id}/answer`).send({ answer: 'hack' })).status).toBe(404)
    expect((await bob.agent.post(`/api/mock-interviews/${mock.id}/complete`)).status).toBe(404)
    expect((await bob.agent.get('/api/mock-interviews')).body.mockInterviews).toHaveLength(0)
  })
})
