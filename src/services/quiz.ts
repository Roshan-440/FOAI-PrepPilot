import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QuizAttemptDto, QuizAttemptSummaryDto, QuizResultDto, QuizSourceType } from '@shared/quiz'
import { api } from '@/lib/api'

export const useQuizHistory = () => useQuery({ queryKey: ['quizzes'], queryFn: async () => (await api<{ quizzes: QuizAttemptSummaryDto[] }>('/quizzes')).quizzes })

export const useQuizAttempt = (id: string) =>
  useQuery({ queryKey: ['quiz', id], queryFn: async () => (await api<{ quiz: QuizAttemptDto | QuizResultDto }>(`/quizzes/${id}`)).quiz, retry: false })

export function useStartQuiz() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { sourceType: QuizSourceType; topicId?: string; subjectId?: string; count: number }) =>
      api<{ quiz: QuizAttemptDto }>('/quizzes', { method: 'POST', body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['quizzes'] }),
  })
}

export function useSubmitQuiz(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (answers: { questionId: string; answer: string }[]) => api<{ quiz: QuizResultDto }>(`/quizzes/${id}/submit`, { method: 'POST', body: { answers } }),
    onSuccess: (data) => {
      qc.setQueryData(['quiz', id], data.quiz)
      void qc.invalidateQueries({ queryKey: ['quizzes'] })
      void qc.invalidateQueries({ queryKey: ['subjects'] })
      void qc.invalidateQueries({ queryKey: ['revision'] })
      void qc.invalidateQueries({ queryKey: ['readiness'] })
    },
  })
}
