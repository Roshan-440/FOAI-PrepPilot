import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db, schema } from '../db/client'
import { notFound } from '../utils/errors'

const { notifications } = schema

export type NotificationType = 'REVISION_RECOMMENDED' | 'TASK_RESCHEDULED' | 'MOCK_INTERVIEW_COMPLETED' | 'WEAK_TOPIC_DETECTED'

/** Fire-and-forget: notification creation should never fail the request that triggered it. */
export async function notify(userId: string, type: NotificationType, title: string, body: string): Promise<void> {
  try {
    await db.insert(notifications).values({ userId, type, title, body })
  } catch (err) {
    console.error('[notificationService] failed to create notification:', err instanceof Error ? err.message : err)
  }
}

export interface NotificationDto { id: string; type: string; title: string; body: string; read: boolean; createdAt: string }

export async function listNotifications(userId: string, limit = 30): Promise<NotificationDto[]> {
  const rows = await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit)
  return rows.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, read: n.readAt !== null, createdAt: n.createdAt.toISOString() }))
}

export async function unreadCount(userId: string): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
  return row?.n ?? 0
}

export async function markRead(userId: string, id: string): Promise<void> {
  const updated = await db.update(notifications).set({ readAt: sql`now()` }).where(and(eq(notifications.id, id), eq(notifications.userId, userId))).returning({ id: notifications.id })
  if (updated.length === 0) throw notFound('Notification not found.')
}

export async function markAllRead(userId: string): Promise<void> {
  await db.update(notifications).set({ readAt: sql`now()` }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
}
