/**
 * Pure, deterministic study-plan generator. Given the student's dates, daily hours and a prioritized topic list,
 * it produces a non-overlapping day-by-day schedule that never exceeds the daily time budget. No AI/LLM involved:
 * the plan is fully explainable and reproducible from its inputs.
 */
import type { Difficulty, TopicStatus } from './academics'

export type TaskType = 'LEARN' | 'PRACTICE' | 'QUIZ' | 'REVISION' | 'INTERVIEW'
export type PriorityLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export interface PlannerTopic {
  topicId: string
  subjectId: string
  subjectName: string
  topicName: string
  status: TopicStatus
  difficulty: Difficulty
  interviewRelevance: number
  lastScore: number | null
  priorityScore: number
  priorityLevel: PriorityLevel
  /** Minutes recommended for this topic (already priority/difficulty adjusted). */
  recommendedMinutes: number
  reasons: string[]
}

export interface PlannerInput {
  /** ISO YYYY-MM-DD, inclusive. */
  startDate: string
  endDate: string
  hoursPerDay: number
  /** ISO weekdays the student is willing to study, 1 = Monday .. 7 = Sunday. */
  studyDays: number[]
  topics: PlannerTopic[]
  /** Whether the plan should include periodic interview-practice tasks (e.g. an interview date is set and some topics are interview-relevant). */
  includeInterviewPractice: boolean
  /** Minutes after midnight the study block starts each day. Defaults to 18:00. */
  dayStartMinute?: number
}

export interface PlannedTask {
  date: string
  startMinute: number
  durationMinutes: number
  type: TaskType
  subjectId: string
  topicId: string | null
  priority: PriorityLevel
  reason: string
}

export interface PlannerResult { tasks: PlannedTask[]; warnings: string[]; totalPlannedMinutes: number; totalAvailableMinutes: number }

const QUIZ_MINUTES = 25
const INTERVIEW_MINUTES = 40
const MIN_CHUNK_MINUTES = 20
const REVISION_FRACTION = 0.5 // a topic that only needs revision gets half its recommended time

function eachStudyDate(startDate: string, endDate: string, studyDays: number[]): string[] {
  const dates: string[] = []
  const cursor = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  const allowed = new Set(studyDays)
  while (cursor.getTime() <= end.getTime()) {
    const isoWeekday = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay()
    if (allowed.has(isoWeekday)) dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

interface Candidate { type: TaskType; subjectId: string; topicId: string | null; priority: PriorityLevel; minutes: number; reason: string; flexible: boolean }

function buildCandidates(topics: PlannerTopic[], includeInterviewPractice: boolean): Candidate[] {
  const candidates: Candidate[] = []
  const bySubject = new Map<string, { subjectId: string; scheduledAny: boolean }>()

  for (const t of [...topics].sort((a, b) => b.priorityScore - a.priorityScore)) {
    if (!bySubject.has(t.subjectId)) bySubject.set(t.subjectId, { subjectId: t.subjectId, scheduledAny: false })

    if (t.status === 'COMPLETED') {
      // Completed topics don't need a LEARN task, but a weak or explicitly-flagged one still deserves a short revision pass.
      if (t.lastScore !== null && t.lastScore < 70) {
        candidates.push({
          type: 'REVISION', subjectId: t.subjectId, topicId: t.topicId, priority: t.priorityLevel, flexible: true,
          minutes: Math.max(MIN_CHUNK_MINUTES, Math.round(t.recommendedMinutes * REVISION_FRACTION)),
          reason: `Revisiting because your last quiz score was ${t.lastScore}%.`,
        })
      }
      continue
    }

    const type: TaskType = t.status === 'NEEDS_REVISION' ? 'REVISION' : 'LEARN'
    candidates.push({
      type, subjectId: t.subjectId, topicId: t.topicId, priority: t.priorityLevel, flexible: false,
      minutes: t.recommendedMinutes,
      reason: t.reasons[0] ?? 'Prioritized based on your current progress.',
    })
    bySubject.get(t.subjectId)!.scheduledAny = true
  }

  // One short quiz per subject that actually has active study time scheduled, reinforcing what was just learned.
  for (const { subjectId, scheduledAny } of bySubject.values()) {
    if (scheduledAny) {
      candidates.push({ type: 'QUIZ', subjectId, topicId: null, priority: 'MEDIUM', flexible: true, minutes: QUIZ_MINUTES, reason: 'Quick check on what you studied in this subject.' })
    }
  }

  if (includeInterviewPractice) {
    const relevantSubjects = new Set(topics.filter((t) => t.interviewRelevance >= 4).map((t) => t.subjectId))
    for (const subjectId of relevantSubjects) {
      candidates.push({ type: 'INTERVIEW', subjectId, topicId: null, priority: 'MEDIUM', flexible: true, minutes: INTERVIEW_MINUTES, reason: 'Interview practice for a high-relevance subject ahead of your interview date.' })
    }
  }

  const rank: Record<PriorityLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
  return candidates.sort((a, b) => rank[a.priority] - rank[b.priority])
}

/** Greedily places candidates into available days, in priority order, never exceeding the daily budget or overlapping tasks. */
export function generateStudyPlan(input: PlannerInput): PlannerResult {
  const dates = eachStudyDate(input.startDate, input.endDate, input.studyDays)
  const dayBudget = Math.round(input.hoursPerDay * 60)
  const dayStart = input.dayStartMinute ?? 18 * 60
  const remainingByDate = new Map(dates.map((d) => [d, dayBudget]))
  const cursorByDate = new Map(dates.map((d) => [d, dayStart]))

  const candidates = buildCandidates(input.topics, input.includeInterviewPractice)
  const tasks: PlannedTask[] = []
  const unscheduled: Candidate[] = []

  for (const c of candidates) {
    let placed = false
    for (const date of dates) {
      const remaining = remainingByDate.get(date)!
      if (remaining <= 0) continue
      const duration = remaining >= c.minutes ? c.minutes : c.flexible && remaining >= MIN_CHUNK_MINUTES ? remaining : 0
      if (duration === 0) continue
      tasks.push({ date, startMinute: cursorByDate.get(date)!, durationMinutes: duration, type: c.type, subjectId: c.subjectId, topicId: c.topicId, priority: c.priority, reason: c.reason })
      cursorByDate.set(date, cursorByDate.get(date)! + duration)
      remainingByDate.set(date, remaining - duration)
      placed = true
      break
    }
    if (!placed) unscheduled.push(c)
  }

  const totalAvailableMinutes = dates.length * dayBudget
  const totalPlannedMinutes = tasks.reduce((sum, t) => sum + t.durationMinutes, 0)
  const warnings: string[] = []
  if (dates.length === 0) {
    warnings.push('No study days fall between the selected dates. Widen the date range or choose more study days.')
  } else if (unscheduled.length > 0) {
    const neededMinutes = unscheduled.reduce((s, c) => s + c.minutes, 0)
    const neededHours = Math.round((neededMinutes / 60) * 10) / 10
    const topicWord = unscheduled.length === 1 ? 'item' : 'items'
    warnings.push(
      `This plan needs about ${neededHours} more hour(s) than you have available. ${unscheduled.length} ${topicWord} could not be scheduled — consider extending the end date, adding study days, or increasing daily hours.`,
    )
  }

  return { tasks, warnings, totalPlannedMinutes, totalAvailableMinutes }
}
