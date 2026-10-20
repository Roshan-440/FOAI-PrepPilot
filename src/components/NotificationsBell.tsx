import { Bell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/services/notifications'

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function NotificationsBell() {
  const { data } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [open])

  const unread = data?.unreadCount ?? 0

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="relative">
        <Bell className="size-5" aria-hidden="true" />
        {unread > 0 && <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">{unread > 9 ? '9+' : unread}</span>}
      </Button>
      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && <button onClick={() => markAllRead.mutate()} className="text-xs font-medium text-primary-text hover:underline">Mark all read</button>}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {!data || data.notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">You're all caught up.</p>
            ) : (
              <ul>
                {data.notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => !n.read && markRead.mutate(n.id)}
                      className={`block w-full border-b border-border px-4 py-3 text-left text-sm last:border-0 hover:bg-muted ${n.read ? '' : 'bg-primary-soft/40'}`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
                        <div className="min-w-0">
                          <p className="font-medium">{n.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
