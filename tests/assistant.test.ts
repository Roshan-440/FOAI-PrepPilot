import { beforeEach, describe, expect, it } from 'vitest'
import { app, resetDb, signedUpAgent } from './helpers'
import request from 'supertest'

beforeEach(resetDb)

describe('AI assistant', () => {
  it('requires authentication', async () => {
    expect((await request(app).post('/api/assistant/chat').send({ messages: [{ role: 'user', content: 'hi' }] })).status).toBe(401)
  })

  it('answers from real data instead of fabricating progress when there is none yet', async () => {
    const { agent } = await signedUpAgent()
    const res = await agent.post('/api/assistant/chat').send({ messages: [{ role: 'user', content: 'What should I study today?' }] })
    expect(res.status).toBe(200)
    expect(res.body.reply.toLowerCase()).toMatch(/subject|topic/)
    expect(res.body.source).toBe('FALLBACK_BANK') // AI_PROVIDER=mock in this environment
  })

  it('grounds its readiness answer in the real computed score', async () => {
    const { agent } = await signedUpAgent()
    const readiness = await agent.get('/api/readiness')
    const res = await agent.post('/api/assistant/chat').send({ messages: [{ role: 'user', content: 'How ready am I for my interview?' }] })
    expect(res.body.reply).toContain(`${readiness.body.readiness.overall}%`)
  })

  it('validates the chat payload', async () => {
    const { agent } = await signedUpAgent()
    expect((await agent.post('/api/assistant/chat').send({ messages: [] })).status).toBe(400)
    expect((await agent.post('/api/assistant/chat').send({})).status).toBe(400)
  })
})
