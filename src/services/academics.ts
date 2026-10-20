import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ProfileDto, ProfileInput, SubjectDto, SubjectInput, TopicDto, TopicInput } from '@shared/academics'
import { api } from '@/lib/api'

export const keys = {
  profile: ['profile'] as const,
  subjects: ['subjects'] as const,
  subject: (id: string) => ['subject', id] as const,
}

export const useProfile = () =>
  useQuery({ queryKey: keys.profile, queryFn: async () => (await api<{ profile: ProfileDto }>('/profile')).profile })

export function useSaveProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ProfileInput) => (await api<{ profile: ProfileDto }>('/profile', { method: 'PUT', body: input })).profile,
    onSuccess: (profile) => {
      qc.setQueryData(keys.profile, profile)
      void qc.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })
}

export const useSubjects = () =>
  useQuery({ queryKey: keys.subjects, queryFn: async () => (await api<{ subjects: SubjectDto[] }>('/subjects')).subjects })

export const useSubjectDetail = (id: string) =>
  useQuery({ queryKey: keys.subject(id), queryFn: () => api<{ subject: SubjectDto; topics: TopicDto[] }>(`/subjects/${id}`), retry: false })

/** Any change to subjects/topics can alter progress everywhere, so refresh both views. */
function useInvalidateAcademics() {
  const qc = useQueryClient()
  return () => Promise.all([qc.invalidateQueries({ queryKey: keys.subjects }), qc.invalidateQueries({ queryKey: ['subject'] })])
}

export function useCreateSubject() {
  const done = useInvalidateAcademics()
  return useMutation({ mutationFn: (input: SubjectInput) => api<{ subject: SubjectDto }>('/subjects', { method: 'POST', body: input }), onSuccess: done })
}
export function useUpdateSubject(id: string) {
  const done = useInvalidateAcademics()
  return useMutation({ mutationFn: (input: Partial<SubjectInput>) => api<{ subject: SubjectDto }>(`/subjects/${id}`, { method: 'PATCH', body: input }), onSuccess: done })
}
export function useDeleteSubject() {
  const done = useInvalidateAcademics()
  return useMutation({ mutationFn: (id: string) => api(`/subjects/${id}`, { method: 'DELETE' }), onSuccess: done })
}
export function useCreateTopic(subjectId: string) {
  const done = useInvalidateAcademics()
  return useMutation({ mutationFn: (input: TopicInput) => api<{ topic: TopicDto }>(`/subjects/${subjectId}/topics`, { method: 'POST', body: input }), onSuccess: done })
}
export function useUpdateTopic() {
  const done = useInvalidateAcademics()
  return useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Partial<TopicInput> }) => api<{ topic: TopicDto }>(`/topics/${id}`, { method: 'PATCH', body: patch }), onSuccess: done })
}
export function useDeleteTopic() {
  const done = useInvalidateAcademics()
  return useMutation({ mutationFn: (id: string) => api(`/topics/${id}`, { method: 'DELETE' }), onSuccess: done })
}
