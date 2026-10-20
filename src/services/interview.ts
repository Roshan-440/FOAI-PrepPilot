import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InterviewAnswerDto, InterviewCategory, InterviewQuestionDto, MockInterviewDto, MockInterviewSummaryDto, MockInterviewType } from '@shared/interview'
import { api } from '@/lib/api'

export const usePracticeQuestions = (category?: InterviewCategory, difficulty?: string) =>
  useQuery({
    queryKey: ['interview-questions', category, difficulty],
    queryFn: async () => (await api<{ questions: InterviewQuestionDto[] }>(`/interview/questions${category ? `?category=${category}` : ''}${difficulty ? `${category ? '&' : '?'}difficulty=${difficulty}` : ''}`)).questions,
  })

export function useGenerateQuestions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { role: string; category: InterviewCategory; difficulty: string; count: number }) => api<{ questions: InterviewQuestionDto[] }>('/interview/questions/generate', { method: 'POST', body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['interview-questions'] }),
  })
}

export function useAnswerPracticeQuestion() {
  return useMutation({ mutationFn: ({ questionId, answer }: { questionId: string; answer: string }) => api<{ answer: InterviewAnswerDto }>(`/interview/questions/${questionId}/answer`, { method: 'POST', body: { answer } }) })
}

export const useMockInterviews = () => useQuery({ queryKey: ['mock-interviews'], queryFn: async () => (await api<{ mockInterviews: MockInterviewSummaryDto[] }>('/mock-interviews')).mockInterviews })
export const useMockInterview = (id: string) => useQuery({ queryKey: ['mock-interview', id], queryFn: async () => (await api<{ mockInterview: MockInterviewDto }>(`/mock-interviews/${id}`)).mockInterview, retry: false })

export function useStartMockInterview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { role: string; type: MockInterviewType; difficulty: string; questionCount: number }) => api<{ mockInterview: MockInterviewDto }>('/mock-interviews', { method: 'POST', body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['mock-interviews'] }),
  })
}
export function useAnswerMockQuestion(mockId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ questionId, answer }: { questionId: string; answer: string }) => api<{ answer: InterviewAnswerDto }>(`/mock-interviews/${mockId}/questions/${questionId}/answer`, { method: 'POST', body: { answer } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['mock-interview', mockId] }),
  })
}
export function useCompleteMockInterview(mockId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<{ mockInterview: MockInterviewDto }>(`/mock-interviews/${mockId}/complete`, { method: 'POST' }),
    onSuccess: (data) => {
      qc.setQueryData(['mock-interview', mockId], data.mockInterview)
      void qc.invalidateQueries({ queryKey: ['mock-interviews'] })
      void qc.invalidateQueries({ queryKey: ['readiness'] })
    },
  })
}
