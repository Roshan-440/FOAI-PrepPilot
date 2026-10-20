import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { app, resetDb, signedUpAgent } from './helpers'

beforeEach(resetDb)

describe('notifications', () => {
  it('creates a notification when a new revision recommendation appears, and lets the student mark it read', async () => {
    const { agent } = await signedUpAgent()
    const subject = (await agent.post('/api/subjects').send({ name: 'DBMS' })).body.subject
    const topic = (await agent.post(`/api/subjects/${subject.id}/topics`).send({ name: 'Joins' })).body.topic

    let list = await agent.get('/api/notifications')
    expect(list.body.unreadCount).toBe(0)

    await agent.patch(`/api/topics/${topic.id}`).send({ status: 'NEEDS_REVISION' })

    list = await agent.get('/api/notifications')
    expect(list.body.unreadCount).toBe(1)
    expect(list.body.notifications[0].type).toBe('REVISION_RECOMMENDED')
    expect(list.body.notifications[0].read).toBe(false)

    const markRead = await agent.post(`/api/notifications/${list.body.notifications[0].id}/read`)
    expect(markRead.status).toBe(204)
    list = await agent.get('/api/notifications')
    expect(list.body.unreadCount).toBe(0)
    expect(list.body.notifications[0].read).toBe(true)
  })

  it('creates a notification when a mock interview completes', async () => {
    const { agent } = await signedUpAgent()
    const mock = (await agent.post('/api/mock-interviews').send({ role: 'QA Engineer', type: 'HR', difficulty: 'BEGINNER', questionCount: 3 })).body.mockInterview
    await agent.post(`/api/mock-interviews/${mock.id}/questions/${mock.questions[0].id}/answer`).send({ answer: 'A short answer.' })
    await agent.post(`/api/mock-interviews/${mock.id}/complete`)

    const list = await agent.get('/api/notifications')
    expect(list.body.notifications.some((n: { type: string }) => n.type === 'MOCK_INTERVIEW_COMPLETED')).toBe(true)
  })

  it('mark-all-read clears every unread notification', async () => {
    const { agent } = await signedUpAgent()
    const subject = (await agent.post('/api/subjects').send({ name: 'OS' })).body.subject
    const t1 = (await agent.post(`/api/subjects/${subject.id}/topics`).send({ name: 'Deadlocks' })).body.topic
    const t2 = (await agent.post(`/api/subjects/${subject.id}/topics`).send({ name: 'Scheduling' })).body.topic
    await agent.patch(`/api/topics/${t1.id}`).send({ status: 'NEEDS_REVISION' })
    await agent.patch(`/api/topics/${t2.id}`).send({ status: 'NEEDS_REVISION' })

    expect((await agent.get('/api/notifications')).body.unreadCount).toBe(2)
    await agent.post('/api/notifications/read-all')
    expect((await agent.get('/api/notifications')).body.unreadCount).toBe(0)
  })

  it("never lets one user read or mark another user's notifications", async () => {
    const alice = await signedUpAgent()
    const bob = await signedUpAgent()
    const subject = (await alice.agent.post('/api/subjects').send({ name: 'CN' })).body.subject
    const topic = (await alice.agent.post(`/api/subjects/${subject.id}/topics`).send({ name: 'Routing' })).body.topic
    await alice.agent.patch(`/api/topics/${topic.id}`).send({ status: 'NEEDS_REVISION' })
    const notif = (await alice.agent.get('/api/notifications')).body.notifications[0]

    expect((await bob.agent.get('/api/notifications')).body.notifications).toHaveLength(0)
    expect((await bob.agent.post(`/api/notifications/${notif.id}/read`)).status).toBe(404)
  })

  it('requires authentication', async () => {
    expect((await request(app).get('/api/notifications')).status).toBe(401)
  })
})
