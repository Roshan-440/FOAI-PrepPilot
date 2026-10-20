import { z } from 'zod'

export const INTERVIEW_CATEGORIES = ['TECHNICAL', 'HR', 'BEHAVIORAL', 'PROJECT'] as const
export const MOCK_INTERVIEW_TYPES = ['TECHNICAL', 'HR', 'MIXED'] as const
export type InterviewCategory = (typeof INTERVIEW_CATEGORIES)[number]
export type MockInterviewType = (typeof MOCK_INTERVIEW_TYPES)[number]

export const generateQuestionsSchema = z.object({
  role: z.string().trim().min(1).max(100),
  category: z.enum(INTERVIEW_CATEGORIES),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  count: z.number().int().min(1).max(10).default(5),
})

export const startMockInterviewSchema = z.object({
  role: z.string().trim().min(1).max(100),
  type: z.enum(MOCK_INTERVIEW_TYPES),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  questionCount: z.number().int().min(3).max(12).default(5),
})

export const answerMockQuestionSchema = z.object({ answer: z.string().trim().min(1).max(4000) })
export const answerPracticeQuestionSchema = z.object({ questionId: z.uuid(), answer: z.string().trim().min(1).max(4000) })

export interface InterviewQuestionDto {
  id: string; role: string | null; category: InterviewCategory; difficulty: string; topic: string
  question: string; testing: string; keyPoints: string[]; source: 'AI' | 'FALLBACK_BANK' | 'USER'
}

export interface AnswerScoresDto { correctness: number; relevance: number; completeness: number; clarity: number; depth: number; communication: number }
export interface InterviewAnswerDto {
  id: string; questionId: string; answer: string; scores: AnswerScoresDto; overallScore: number; feedback: string; evaluationSource: 'AI' | 'FALLBACK_BANK' | 'USER'
}

export interface MockInterviewQuestionDto { id: string; position: number; category: InterviewCategory; topic: string; question: string; keyPoints: string[] }
export interface MockInterviewSummaryDto {
  id: string; role: string; type: MockInterviewType; difficulty: string; questionCount: number
  status: 'IN_PROGRESS' | 'COMPLETED'; overallScore: number | null; startedAt: string; completedAt: string | null
}
export interface MockInterviewReport {
  overallScore: number; strengths: string[]; weaknesses: string[]; recommendedTopics: string[]; suggestedImprovements: string[]
}
export interface MockInterviewDto extends MockInterviewSummaryDto {
  questions: MockInterviewQuestionDto[]
  answers: Record<string, InterviewAnswerDto>
  report: MockInterviewReport | null
}
