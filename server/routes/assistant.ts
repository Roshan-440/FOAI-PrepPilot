import { Router } from 'express'
import { z } from 'zod'
import { currentUser } from '../middleware/auth'
import { assistantChat } from '../services/assistantService'

const chatSchema = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(2000) })).min(1).max(20),
})

export const assistantRouter = Router()

assistantRouter.post('/assistant/chat', async (req, res) => {
  const input = chatSchema.parse(req.body)
  const result = await assistantChat(currentUser(req).id, input.messages)
  res.json(result)
})
