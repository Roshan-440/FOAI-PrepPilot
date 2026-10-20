import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { app, resetDb, signedUpAgent } from './helpers'

beforeEach(resetDb)

async function makeSubject(agent: request.Agent, name = 'Data Structures') {
  const res = await agent.post('/api/subjects').send({ name, importance: 5 })
  expect(res.status).toBe(201)
  return res.body.subject as { id: string }
}

describe('profile & onboarding', () => {
  it('saves onboarding data, skills (deduplicated) and marks onboarding complete', async () => {
    const { agent } = await signedUpAgent()
    const res = await agent.put('/api/profile').send({
      degree: 'B.Tech', department: 'CSE', targetRole: 'Backend Developer',
      skills: ['Python', 'python', 'SQL'], availableHoursPerDay: 3, preferredStudyDays: [1, 3, 3, 5], completeOnboarding: true,
    })
    expect(res.status).toBe(200)
    expect(res.body.profile.skills).toEqual(['Python', 'SQL'])
    expect(res.body.profile.preferredStudyDays).toEqual([1, 3, 5])
    expect(res.body.profile.onboardingCompleted).toBe(true)
    const me = await agent.get('/api/auth/me')
    expect(me.body.user.onboardingCompleted).toBe(true)
  })

  it('rejects invalid values', async () => {
    const { agent } = await signedUpAgent()
    for (const bad of [{ availableHoursPerDay: 30 }, { examDate: '2026-13-45' }, { preferredStudyDays: [0] }, { preferredSessionMinutes: -5 }]) {
      const res = await agent.put('/api/profile').send(bad)
      expect(res.status).toBe(400)
    }
  })
})

describe('subjects & topics', () => {
  it('requires authentication', async () => {
    for (const path of ['/api/subjects', '/api/topics', '/api/profile']) {
      expect((await request(app).get(path)).status).toBe(401)
    }
  })

  it('creates, lists, updates and deletes a subject with computed progress', async () => {
    const { agent } = await signedUpAgent()
    const s = await makeSubject(agent)
    await agent.post(`/api/subjects/${s.id}/topics`).send({ name: 'Arrays', status: 'COMPLETED' }).expect(201)
    await agent.post(`/api/subjects/${s.id}/topics`).send({ name: 'Trees' }).expect(201)
    const list = await agent.get('/api/subjects')
    expect(list.body.subjects[0]).toMatchObject({ topicCount: 2, completedCount: 1, completionPercent: 50 })
    const upd = await agent.patch(`/api/subjects/${s.id}`).send({ name: 'DSA', importance: 4 })
    expect(upd.body.subject).toMatchObject({ name: 'DSA', importance: 4 })
    await agent.delete(`/api/subjects/${s.id}`).expect(204)
    expect((await agent.get(`/api/subjects/${s.id}`)).status).toBe(404)
    expect((await agent.get('/api/topics')).body.topics).toHaveLength(0) // cascade
  })

  it('rejects duplicates (case-insensitive) and invalid input', async () => {
    const { agent } = await signedUpAgent()
    const s = await makeSubject(agent, 'DBMS')
    expect((await agent.post('/api/subjects').send({ name: 'dbms' })).status).toBe(409)
    await agent.post(`/api/subjects/${s.id}/topics`).send({ name: 'SQL' }).expect(201)
    expect((await agent.post(`/api/subjects/${s.id}/topics`).send({ name: 'sql' })).status).toBe(409)
    for (const bad of [{ name: '' }, { name: 'X', importance: 9 }, { name: 'X', estimatedMinutes: -10 }, { name: 'X', status: 'DONE' }, { name: 'X', confidence: 0 }]) {
      expect((await agent.post(`/api/subjects/${s.id}/topics`).send(bad)).status).toBe(400)
    }
  })

  it('stamps lastStudiedAt when status moves forward', async () => {
    const { agent } = await signedUpAgent()
    const s = await makeSubject(agent)
    const t = (await agent.post(`/api/subjects/${s.id}/topics`).send({ name: 'Graphs' })).body.topic
    expect(t.lastStudiedAt).toBeNull()
    const upd = await agent.patch(`/api/topics/${t.id}`).send({ status: 'IN_PROGRESS', confidence: 2 })
    expect(upd.body.topic.lastStudiedAt).not.toBeNull()
    expect(upd.body.topic.confidence).toBe(2)
  })
})

describe('user data isolation', () => {
  it("never lets one user read, edit, delete or attach to another user's data", async () => {
    const alice = await signedUpAgent({ name: 'Alice' })
    const bob = await signedUpAgent({ name: 'Bob' })
    const s = await makeSubject(alice.agent)
    const t = (await alice.agent.post(`/api/subjects/${s.id}/topics`).send({ name: 'Arrays' })).body.topic

    expect((await bob.agent.get(`/api/subjects/${s.id}`)).status).toBe(404)
    expect((await bob.agent.patch(`/api/subjects/${s.id}`).send({ name: 'Hacked' })).status).toBe(404)
    expect((await bob.agent.delete(`/api/subjects/${s.id}`)).status).toBe(404)
    expect((await bob.agent.post(`/api/subjects/${s.id}/topics`).send({ name: 'Injected' })).status).toBe(404)
    expect((await bob.agent.patch(`/api/topics/${t.id}`).send({ status: 'COMPLETED' })).status).toBe(404)
    expect((await bob.agent.delete(`/api/topics/${t.id}`)).status).toBe(404)
    expect((await bob.agent.get('/api/subjects')).body.subjects).toHaveLength(0)
    expect((await bob.agent.get('/api/topics')).body.topics).toHaveLength(0)

    // Alice's data is untouched, and a malformed id is a plain 404.
    const after = await alice.agent.get(`/api/subjects/${s.id}`)
    expect(after.body.subject.name).toBe('Data Structures')
    expect(after.body.topics).toHaveLength(1)
    expect(after.body.topics[0].status).toBe('NOT_STARTED')
    expect((await alice.agent.get('/api/subjects/not-a-uuid')).status).toBe(404)
  })

  it('allows two users to have subjects with the same name', async () => {
    const a = await signedUpAgent()
    const b = await signedUpAgent()
    await makeSubject(a.agent, 'Operating Systems')
    await makeSubject(b.agent, 'Operating Systems')
  })
})
