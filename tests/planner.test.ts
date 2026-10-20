import { describe, expect, it } from 'vitest'
import { generateStudyPlan, type PlannerTopic } from '../shared/planner'

function topic(overrides: Partial<PlannerTopic> = {}): PlannerTopic {
  return {
    topicId: `t-${Math.random()}`, subjectId: 's1', subjectName: 'DSA', topicName: 'Arrays', status: 'NOT_STARTED',
    difficulty: 'INTERMEDIATE', interviewRelevance: 3, lastScore: null, priorityScore: 50, priorityLevel: 'MEDIUM',
    recommendedMinutes: 60, reasons: ['Topic has not been started yet'], ...overrides,
  }
}

describe('generateStudyPlan', () => {
  it('never schedules overlapping tasks and never exceeds the daily budget', () => {
    const topics = Array.from({ length: 6 }, (_, i) => topic({ topicId: `t${i}`, recommendedMinutes: 50 }))
    const result = generateStudyPlan({ startDate: '2026-10-05', endDate: '2026-10-11', hoursPerDay: 2, studyDays: [1, 2, 3, 4, 5, 6, 7], topics, includeInterviewPractice: false })
    const byDate = new Map<string, typeof result.tasks>()
    for (const t of result.tasks) byDate.set(t.date, [...(byDate.get(t.date) ?? []), t])
    for (const [, dayTasks] of byDate) {
      const sorted = [...dayTasks].sort((a, b) => a.startMinute - b.startMinute)
      let totalMinutes = 0
      for (let i = 0; i < sorted.length; i++) {
        const cur = sorted[i]
        if (!cur) continue
        totalMinutes += cur.durationMinutes
        const prev = sorted[i - 1]
        if (i > 0 && prev) expect(cur.startMinute).toBeGreaterThanOrEqual(prev.startMinute + prev.durationMinutes)
      }
      expect(totalMinutes).toBeLessThanOrEqual(120)
    }
  })

  it('never schedules a LEARN task for a completed topic', () => {
    const completedTopic = topic({ status: 'COMPLETED', lastScore: 95 })
    const topics = [completedTopic, topic({ status: 'NOT_STARTED' })]
    const result = generateStudyPlan({ startDate: '2026-10-05', endDate: '2026-10-06', hoursPerDay: 3, studyDays: [1, 2, 3, 4, 5, 6, 7], topics, includeInterviewPractice: false })
    expect(result.tasks.some((t) => t.type === 'LEARN' && t.topicId === completedTopic.topicId)).toBe(false)
  })

  it('schedules a short revision task for a completed-but-weak topic instead of ignoring it', () => {
    const topics = [topic({ status: 'COMPLETED', lastScore: 45, recommendedMinutes: 40 })]
    const result = generateStudyPlan({ startDate: '2026-10-05', endDate: '2026-10-06', hoursPerDay: 2, studyDays: [1, 2, 3, 4, 5, 6, 7], topics, includeInterviewPractice: false })
    const rev = result.tasks.find((t) => t.type === 'REVISION')
    expect(rev).toBeDefined()
    expect(rev!.durationMinutes).toBeLessThan(40)
  })

  it('gives a NEEDS_REVISION topic a REVISION task, not a LEARN task', () => {
    const topics = [topic({ status: 'NEEDS_REVISION' })]
    const result = generateStudyPlan({ startDate: '2026-10-05', endDate: '2026-10-06', hoursPerDay: 2, studyDays: [1, 2, 3, 4, 5, 6, 7], topics, includeInterviewPractice: false })
    expect(result.tasks[0]?.type).toBe('REVISION')
  })

  it('adds a QUIZ task for a subject once real study time was scheduled for it', () => {
    const topics = [topic({ recommendedMinutes: 40 })]
    const result = generateStudyPlan({ startDate: '2026-10-05', endDate: '2026-10-07', hoursPerDay: 2, studyDays: [1, 2, 3, 4, 5, 6, 7], topics, includeInterviewPractice: false })
    expect(result.tasks.some((t) => t.type === 'QUIZ' && t.subjectId === 's1')).toBe(true)
  })

  it('respects the chosen study days (no tasks on excluded weekdays)', () => {
    const topics = Array.from({ length: 4 }, () => topic())
    // 2026-10-05 is a Monday; only allow Sunday (7).
    const result = generateStudyPlan({ startDate: '2026-10-05', endDate: '2026-10-11', hoursPerDay: 4, studyDays: [7], topics, includeInterviewPractice: false })
    for (const t of result.tasks) expect(t.date).toBe('2026-10-11')
  })

  it('clearly reports an impossible workload instead of silently dropping items', () => {
    const topics = Array.from({ length: 20 }, (_, i) => topic({ topicId: `t${i}`, recommendedMinutes: 60 }))
    const result = generateStudyPlan({ startDate: '2026-10-05', endDate: '2026-10-05', hoursPerDay: 1, studyDays: [1], topics, includeInterviewPractice: false })
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toMatch(/could not be scheduled/)
    expect(result.totalPlannedMinutes).toBeLessThanOrEqual(result.totalAvailableMinutes)
  })

  it('reports a clear warning (not a crash) when no study days fall in range', () => {
    const result = generateStudyPlan({ startDate: '2026-10-05', endDate: '2026-10-05', hoursPerDay: 2, studyDays: [3], topics: [topic()], includeInterviewPractice: false })
    expect(result.tasks).toHaveLength(0)
    expect(result.warnings[0]).toMatch(/No study days/)
  })

  it('only adds INTERVIEW tasks for interview-relevant subjects, and only when requested', () => {
    const topics = [topic({ interviewRelevance: 5, recommendedMinutes: 30 }), topic({ topicId: 'low-rel', subjectId: 's2', interviewRelevance: 1, recommendedMinutes: 30 })]
    const withInterview = generateStudyPlan({ startDate: '2026-10-05', endDate: '2026-10-12', hoursPerDay: 4, studyDays: [1, 2, 3, 4, 5, 6, 7], topics, includeInterviewPractice: true })
    const withoutInterview = generateStudyPlan({ startDate: '2026-10-05', endDate: '2026-10-12', hoursPerDay: 4, studyDays: [1, 2, 3, 4, 5, 6, 7], topics, includeInterviewPractice: false })
    expect(withInterview.tasks.some((t) => t.type === 'INTERVIEW' && t.subjectId === 's1')).toBe(true)
    expect(withInterview.tasks.some((t) => t.type === 'INTERVIEW' && t.subjectId === 's2')).toBe(false)
    expect(withoutInterview.tasks.some((t) => t.type === 'INTERVIEW')).toBe(false)
  })

  it('schedules higher-priority topics before lower-priority ones when time is limited', () => {
    const low = topic({ topicId: 'low', priorityScore: 20, priorityLevel: 'LOW', recommendedMinutes: 60 })
    const high = topic({ topicId: 'high', subjectId: 's2', priorityScore: 90, priorityLevel: 'HIGH', recommendedMinutes: 60 })
    const result = generateStudyPlan({ startDate: '2026-10-05', endDate: '2026-10-05', hoursPerDay: 1, studyDays: [1], topics: [low, high], includeInterviewPractice: false })
    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0]?.topicId).toBe('high')
  })

  it('is deterministic: identical input always yields identical output', () => {
    const topics = [topic({ topicId: 'a' }), topic({ topicId: 'b', priorityScore: 70, priorityLevel: 'HIGH' })]
    const input = { startDate: '2026-10-05', endDate: '2026-10-08', hoursPerDay: 2, studyDays: [1, 2, 3, 4, 5, 6, 7], topics, includeInterviewPractice: false }
    expect(generateStudyPlan(input)).toEqual(generateStudyPlan(input))
  })
})
