import type { Difficulty, TopicStatus } from '@shared/academics'

export const STATUS_LABEL: Record<TopicStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  NEEDS_REVISION: 'Needs revision',
}
export const STATUS_TONE: Record<TopicStatus, string> = {
  NOT_STARTED: 'bg-muted text-muted-foreground',
  IN_PROGRESS: 'bg-primary-soft text-primary-text',
  COMPLETED: 'bg-success-soft text-success',
  NEEDS_REVISION: 'bg-warning-soft text-warning',
}
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced' }
export const IMPORTANCE_LABEL = ['', 'Very low', 'Low', 'Medium', 'High', 'Very high']
export const CONFIDENCE_LABEL = ['', 'Very low', 'Low', 'Medium', 'High', 'Very high']

/** Full class names so Tailwind can see them at build time. */
export const COLOR_DOT: Record<string, string> = {
  indigo: 'bg-indigo-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500',
  sky: 'bg-sky-500', violet: 'bg-violet-500', teal: 'bg-teal-500', orange: 'bg-orange-500',
}
export const dotClass = (color: string): string => COLOR_DOT[color] ?? 'bg-indigo-500'
