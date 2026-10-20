import { z } from 'zod'
import { nameSchema } from './validation'

export const TOPIC_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'NEEDS_REVISION'] as const
export const DIFFICULTIES = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const
export const SUBJECT_COLORS = ['indigo', 'emerald', 'amber', 'rose', 'sky', 'violet', 'teal', 'orange'] as const
export type TopicStatus = (typeof TOPIC_STATUSES)[number]
export type Difficulty = (typeof DIFFICULTIES)[number]

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v), 'Enter a valid date.')

const optionalText = (max: number) =>
  z.string().trim().max(max, `Must be at most ${max} characters.`).transform((v) => (v === '' ? null : v)).nullable().optional()
const rating = (label: string) => z.number().int(`${label} must be a whole number.`).min(1, `${label} must be 1-5.`).max(5, `${label} must be 1-5.`)

// ---- Profile / onboarding ----
export const profileInputSchema = z.object({
  name: nameSchema.optional(),
  degree: optionalText(100),
  department: optionalText(100),
  semester: optionalText(40),
  targetRole: optionalText(100),
  targetIndustry: optionalText(100),
  skills: z.array(z.string().trim().min(1).max(40)).max(40, 'Add at most 40 skills.').optional(),
  availableHoursPerDay: z.number().min(0.5, 'Enter at least 0.5 hours.').max(16, 'Enter at most 16 hours.').nullable().optional(),
  preferredSessionMinutes: z.number().int().min(15, 'Use at least 15 minutes.').max(240, 'Use at most 240 minutes.').nullable().optional(),
  preferredStudyDays: z.array(z.number().int().min(1).max(7)).max(7).optional(),
  examDate: isoDate.nullable().optional(),
  interviewDate: isoDate.nullable().optional(),
  completeOnboarding: z.boolean().optional(),
})
export type ProfileInput = z.infer<typeof profileInputSchema>

export interface ProfileDto {
  name: string
  email: string
  degree: string | null
  department: string | null
  semester: string | null
  targetRole: string | null
  targetIndustry: string | null
  skills: string[]
  availableHoursPerDay: number | null
  preferredSessionMinutes: number | null
  preferredStudyDays: number[]
  examDate: string | null
  interviewDate: string | null
  onboardingCompleted: boolean
}

// ---- Subjects ----
export const subjectInputSchema = z.object({
  name: nameSchema.max(100, 'Name must be at most 100 characters.'),
  description: optionalText(500),
  importance: rating('Importance').default(3),
  examDate: isoDate.nullable().optional(),
  color: z.enum(SUBJECT_COLORS).default('indigo'),
})
export const subjectUpdateSchema = subjectInputSchema.partial()
export type SubjectInput = z.infer<typeof subjectInputSchema>

export interface SubjectDto {
  id: string
  name: string
  description: string | null
  importance: number
  examDate: string | null
  color: string
  topicCount: number
  completedCount: number
  /** 0-100, whole number; 0 when the subject has no topics. */
  completionPercent: number
}

// ---- Topics ----
export const topicInputSchema = z.object({
  name: nameSchema.max(120, 'Name must be at most 120 characters.'),
  description: optionalText(500),
  difficulty: z.enum(DIFFICULTIES).default('INTERMEDIATE'),
  importance: rating('Importance').default(3),
  interviewRelevance: rating('Interview relevance').default(3),
  estimatedMinutes: z.number().int('Enter whole minutes.').min(5, 'Use at least 5 minutes.').max(1440, 'Use at most 1440 minutes.').default(60),
  status: z.enum(TOPIC_STATUSES).default('NOT_STARTED'),
  confidence: rating('Confidence').nullable().optional(),
})
export const topicUpdateSchema = topicInputSchema.partial()
export type TopicInput = z.infer<typeof topicInputSchema>

export interface TopicDto {
  id: string
  subjectId: string
  name: string
  description: string | null
  difficulty: Difficulty
  importance: number
  interviewRelevance: number
  estimatedMinutes: number
  status: TopicStatus
  confidence: number | null
  lastStudiedAt: string | null
  lastScore: number | null
}
