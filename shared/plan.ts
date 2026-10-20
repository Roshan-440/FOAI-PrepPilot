import { z } from 'zod'
import { isoDate } from './academics'

export const generatePlanSchema = z
  .object({
    startDate: isoDate,
    endDate: isoDate,
    hoursPerDay: z.number().min(0.5, 'Enter at least 0.5 hours.').max(16, 'Enter at most 16 hours.'),
    studyDays: z.array(z.number().int().min(1).max(7)).min(1, 'Choose at least one study day.'),
    subjectIds: z.array(z.uuid()).optional(),
    goal: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.endDate >= v.startDate, { message: 'End date must be on or after the start date.', path: ['endDate'] })

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
