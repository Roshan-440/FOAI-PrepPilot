import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface StudyTaskDto {
  id: string; date: string; startMinute: number; durationMinutes: number
  type: 'LEARN' | 'PRACTICE' | 'QUIZ' | 'REVISION' | 'INTERVIEW'
  priority: 'HIGH' | 'MEDIUM' | 'LOW'; reason: string; status: 'PENDING' | 'COMPLETED' | 'MISSED' | 'SKIPPED'
  subjectId: string | null; subjectName: string | null; topicId: string | null; topicName: string | null; completedAt: string | null
}
export interface StudyPlanDto {
  id: string; title: string; goal: string | null; startDate: string; endDate: string; hoursPerDay: number
  studyDays: number[]; status: 'ACTIVE' | 'ARCHIVED'; warnings: string[]; createdAt: string; tasks: StudyTaskDto[]
}

export const useActivePlan = () => useQuery({ queryKey: ['plan'], queryFn: async () => (await api<{ plan: StudyPlanDto | null }>('/plan')).plan })

export function useGeneratePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { startDate: string; endDate: string; hoursPerDay: number; studyDays: number[]; subjectIds?: string[]; goal?: string }) =>
      api<{ plan: StudyPlanDto }>('/plan', { method: 'POST', body: input }),
    onSuccess: (data) => qc.setQueryData(['plan'], data.plan),
  })
}

function useTaskAction(action: 'complete' | 'skip') {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => api<{ task: StudyTaskDto }>(`/plan/tasks/${taskId}/${action}`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['plan'] })
      void qc.invalidateQueries({ queryKey: ['subjects'] })
      void qc.invalidateQueries({ queryKey: ['readiness'] })
    },
  })
}
export const useCompleteTask = () => useTaskAction('complete')
export const useSkipTask = () => useTaskAction('skip')
