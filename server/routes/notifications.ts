import { Router } from 'express'
import { z } from 'zod'
import { currentUser } from '../middleware/auth'
import * as notificationService from '../services/notificationService'
import { notFound } from '../utils/errors'

const idParam = (raw: unknown): string => {
  const parsed = z.uuid().safeParse(raw)
  if (!parsed.success) throw notFound()
  return parsed.data
}

export const notificationsRouter = Router()

notificationsRouter.get('/notifications', async (req, res) => {
  const userId = currentUser(req).id
  const [notifications, unread] = await Promise.all([notificationService.listNotifications(userId), notificationService.unreadCount(userId)])
  res.json({ notifications, unreadCount: unread })
})
notificationsRouter.post('/notifications/:id/read', async (req, res) => {
  await notificationService.markRead(currentUser(req).id, idParam(req.params.id))
  res.status(204).end()
})
notificationsRouter.post('/notifications/read-all', async (req, res) => {
  await notificationService.markAllRead(currentUser(req).id)
  res.status(204).end()
})
