import type { Difficulty, TopicStatus } from './academics'

/** Max points each factor can contribute. They sum to 100, so the total score is already 0-100. */
export const PRIORITY_WEIGHTS = {
  incomplete: 25,
  weakness: 25,
  importance: 15,
  interviewRelevance: 15,
  urgency: 15,
  confidenceGap: 5,
} as const

export const PRIORITY_THRESHOLDS = { high: 65, medium: 35 } as const

export interface PriorityFactorInput {
  status: TopicStatus
  importance: number // 1-5
  interviewRelevance: number // 1-5
  confidence: number | null // 1-5
  lastScore: number | null // 0-100
  /** Days until the nearest relevant exam date (subject's own, or the student's profile exam date). Null if none set or already past. */
  daysUntilExam: number | null
  /** Days until the student's profile interview date. Null if not set or already past. */
  daysUntilInterview: number | null
}

export interface PriorityFactor { label: string; points: number; max: number }
export interface PriorityResult { score: number; level: 'HIGH' | 'MEDIUM' | 'LOW'; factors: PriorityFactor[]; reasons: string[] }

/** Tiered urgency curve: closer deadlines contribute more, tapering to 0 beyond ~2 months out. */
function urgencyFraction(days: number | null): number {
  if (days === null || days < 0) return 0
  if (days <= 3) return 1
  if (days <= 7) return 0.8
  if (days <= 14) return 0.55
  if (days <= 30) return 0.3
  if (days <= 60) return 0.12
  return 0
}

const INCOMPLETE_FRACTION: Record<TopicStatus, number> = { NOT_STARTED: 1, IN_PROGRESS: 0.5, NEEDS_REVISION: 0.85, COMPLETED: 0 }
const STATUS_REASON: Record<Exclude<TopicStatus, 'COMPLETED'>, string> = {
  NOT_STARTED: 'Topic has not been started yet',
  IN_PROGRESS: 'Topic is still in progress',
  NEEDS_REVISION: 'Topic was marked as needing revision',
}

/**
 * Deterministic, transparent priority score for a single topic. Every point awarded is explained in `reasons`,
 * so the UI can show exactly why a topic ranks where it does — no black-box or LLM-derived number.
 */
export function computeTopicPriority(input: PriorityFactorInput, weights: typeof PRIORITY_WEIGHTS = PRIORITY_WEIGHTS): PriorityResult {
  const factors: PriorityFactor[] = []
  const reasons: string[] = []

  const incompletePts = round1(INCOMPLETE_FRACTION[input.status] * weights.incomplete)
  factors.push({ label: 'Not yet completed', points: incompletePts, max: weights.incomplete })
  if (input.status !== 'COMPLETED') reasons.push(STATUS_REASON[input.status])

  const weaknessPts = input.lastScore === null ? 0 : round1(((100 - input.lastScore) / 100) * weights.weakness)
  factors.push({ label: 'Recent quiz performance', points: weaknessPts, max: weights.weakness })
  if (input.lastScore !== null && input.lastScore < 70) reasons.push(`Last quiz score was ${input.lastScore}%`)

  const importancePts = round1((clamp15(input.importance) / 5) * weights.importance)
  factors.push({ label: 'Subject/topic importance', points: importancePts, max: weights.importance })
  if (input.importance >= 4) reasons.push('This topic is high importance')

  const interviewPts = round1((clamp15(input.interviewRelevance) / 5) * weights.interviewRelevance)
  factors.push({ label: 'Interview relevance', points: interviewPts, max: weights.interviewRelevance })
  if (input.interviewRelevance >= 4) reasons.push('Interview relevance is high')

  const examFrac = urgencyFraction(input.daysUntilExam)
  const interviewFrac = input.interviewRelevance >= 3 ? urgencyFraction(input.daysUntilInterview) : 0
  const urgencyFrac = Math.max(examFrac, interviewFrac)
  const urgencyPts = round1(urgencyFrac * weights.urgency)
  factors.push({ label: 'Upcoming deadline', points: urgencyPts, max: weights.urgency })
  if (urgencyFrac > 0) {
    if (examFrac >= interviewFrac && input.daysUntilExam !== null) reasons.push(describeDeadline('Exam', input.daysUntilExam))
    else if (input.daysUntilInterview !== null) reasons.push(describeDeadline('Interview', input.daysUntilInterview))
  }

  const confidenceGapPts = input.confidence === null ? round1(0.5 * weights.confidenceGap) : round1(((5 - input.confidence) / 4) * weights.confidenceGap)
  factors.push({ label: 'Confidence gap', points: confidenceGapPts, max: weights.confidenceGap })
  if (input.confidence === null) reasons.push("You haven't rated your confidence yet")
  else if (input.confidence <= 2) reasons.push('Your confidence in this topic is low')

  const score = clampScore(factors.reduce((sum, f) => sum + f.points, 0))
  const level: PriorityResult['level'] = score >= PRIORITY_THRESHOLDS.high ? 'HIGH' : score >= PRIORITY_THRESHOLDS.medium ? 'MEDIUM' : 'LOW'
  return { score, level, factors, reasons }
}

function describeDeadline(label: string, days: number): string {
  if (days <= 0) return `${label} is today`
  if (days === 1) return `${label} is tomorrow`
  if (days <= 14) return `${label} is in ${days} days`
  return `${label} is approaching (${days} days away)`
}
const round1 = (n: number) => Math.round(n * 10) / 10
const clamp15 = (n: number) => Math.min(5, Math.max(1, n))
const clampScore = (n: number) => Math.min(100, Math.max(0, Math.round(n)))

/** Recommended study minutes for a topic given its priority: weaker/higher-priority topics get closer to the full estimate; already-strong ones get a shorter refresher. */
export function estimateStudyMinutes(estimatedMinutes: number, level: PriorityResult['level'], difficulty: Difficulty): number {
  const difficultyMultiplier = difficulty === 'ADVANCED' ? 1.15 : difficulty === 'BEGINNER' ? 0.9 : 1
  const levelMultiplier = level === 'HIGH' ? 1 : level === 'MEDIUM' ? 0.75 : 0.5
  return Math.max(15, Math.round(estimatedMinutes * difficultyMultiplier * levelMultiplier))
}
