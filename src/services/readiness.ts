import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface ReadinessFactor { label: string; detail: string; contribution: number }
export interface ReadinessResult { academic: number; interview: number; overall: number; academicFactors: ReadinessFactor[]; interviewFactors: ReadinessFactor[]; recommendedNextSteps: string[] }
export interface ReadinessTrendPoint { date: string; academic: number; interview: number; overall: number }

export const useReadiness = () => useQuery({ queryKey: ['readiness'], queryFn: async () => (await api<{ readiness: ReadinessResult }>('/readiness')).readiness })
export const useReadinessTrend = () => useQuery({ queryKey: ['readiness-trend'], queryFn: async () => (await api<{ trend: ReadinessTrendPoint[] }>('/readiness/trend')).trend })
