import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface StudyStatsDto { todayMinutes: number; streakDays: number }

export const useTodayStats = () => useQuery({ queryKey: ['stats-today'], queryFn: async () => (await api<{ stats: StudyStatsDto }>('/stats/today')).stats })
