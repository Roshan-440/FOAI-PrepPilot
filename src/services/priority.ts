import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface PrioritizedTopicDto {
  topicId: string; topicName: string; subjectId: string; subjectName: string; status: string
  score: number; level: 'HIGH' | 'MEDIUM' | 'LOW'; reasons: string[]; recommendedMinutes: number; estimatedMinutes: number
}

export const usePriorityTopics = () => useQuery({ queryKey: ['priority-topics'], queryFn: async () => (await api<{ topics: PrioritizedTopicDto[] }>('/priority-topics')).topics })
