import { z } from 'zod'

export const QUIZ_SOURCE_TYPES = ['TOPIC', 'SUBJECT', 'WEAK', 'MIXED'] as const
export type QuizSourceType = (typeof QUIZ_SOURCE_TYPES)[number]
export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER'

export const startQuizSchema = z.object({
  sourceType: z.enum(QUIZ_SOURCE_TYPES),
  topicId: z.uuid().optional(),
  subjectId: z.uuid().optional(),
  count: z.number().int().min(3).max(20).default(8),
}).refine((v) => (v.sourceType === 'TOPIC' ? !!v.topicId : true), { message: 'topicId is required for a topic quiz.', path: ['topicId'] })
  .refine((v) => (v.sourceType === 'SUBJECT' ? !!v.subjectId : true), { message: 'subjectId is required for a subject quiz.', path: ['subjectId'] })

export const submitQuizSchema = z.object({
  answers: z.array(z.object({ questionId: z.uuid(), answer: z.string().max(2000) })).min(1),
})

export interface QuizQuestionPublicDto { id: string; type: QuestionType; question: string; options: string[] | null; topicId: string; topicName: string; difficulty: string }
export interface QuizAnswerResultDto extends QuizQuestionPublicDto { correctAnswer: string; explanation: string; userAnswer: string | null; isCorrect: boolean | null }

export interface QuizAttemptSummaryDto {
  id: string; title: string; sourceType: QuizSourceType; status: 'IN_PROGRESS' | 'SUBMITTED'
  score: number | null; correctCount: number | null; totalCount: number; startedAt: string; submittedAt: string | null
}
export interface QuizAttemptDto extends QuizAttemptSummaryDto { questions: QuizQuestionPublicDto[] }
export interface QuizResultDto extends QuizAttemptSummaryDto {
  questions: QuizAnswerResultDto[]
  weakTopics: { topicId: string; topicName: string; correctCount: number; totalCount: number }[]
  recommendedActions: string[]
}
