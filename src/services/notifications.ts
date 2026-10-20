import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface NotificationDto { id: string; type: string; title: string; body: string; read: boolean; createdAt: string }

export const useNotifications = () =>
  useQuery({
    queryKey: ['notifications'],
    queryFn: async () => api<{ notifications: NotificationDto[]; unreadCount: number }>('/notifications'),
    refetchInterval: 60_000, // light polling so the bell stays current without a websocket
  })

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'POST' }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }) })
}
export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: () => api('/notifications/read-all', { method: 'POST' }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }) })
}
