import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface RevisionItemDto { id: string; topicId: string; topicName: string; subjectId: string; subjectName: string; reason: string; score: number; createdAt: string }

export const useRevisions = () => useQuery({ queryKey: ['revision'], queryFn: async () => (await api<{ recommendations: RevisionItemDto[] }>('/revision')).recommendations })

export function useDismissRevision() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => api(`/revision/${id}/dismiss`, { method: 'POST' }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['revision'] }) })
}
