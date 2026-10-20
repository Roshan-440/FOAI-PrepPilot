import { describe, expect, it } from 'vitest'
import { PRIORITY_THRESHOLDS, computeTopicPriority, estimateStudyMinutes, type PriorityFactorInput } from '../shared/priority'

const base: PriorityFactorInput = {
  status: 'NOT_STARTED', importance: 3, interviewRelevance: 3, confidence: null, lastScore: null, daysUntilExam: null, daysUntilInterview: null,
}

describe('computeTopicPriority', () => {
  it('scores a completed, strong, low-stakes topic as LOW with no incomplete/weakness reasons', () => {
    const r = computeTopicPriority({ ...base, status: 'COMPLETED', importance: 2, interviewRelevance: 2, confidence: 5, lastScore: 95 })
    expect(r.level).toBe('LOW')
    expect(r.reasons).not.toContain('Topic has not been started yet')
    expect(r.reasons.some((x) => x.includes('quiz score'))).toBe(false)
  })

  it('scores a not-started, weak, important, interview-relevant, urgent topic as HIGH with matching reasons', () => {
    const r = computeTopicPriority({
      status: 'NOT_STARTED', importance: 5, interviewRelevance: 5, confidence: 1, lastScore: 40, daysUntilExam: 2, daysUntilInterview: null,
    })
    expect(r.level).toBe('HIGH')
    expect(r.score).toBeGreaterThanOrEqual(PRIORITY_THRESHOLDS.high)
    expect(r.reasons).toEqual(
      expect.arrayContaining([
        'Topic has not been started yet',
        'Last quiz score was 40%',
        'This topic is high importance',
        'Interview relevance is high',
        'Your confidence in this topic is low',
      ]),
    )
    expect(r.reasons.some((x) => x.startsWith('Exam is'))).toBe(true)
  })

  it('is monotonic: a lower score never ranks a strictly-worse-on-every-factor topic above a better one', () => {
    const weak = computeTopicPriority({ ...base, status: 'NOT_STARTED', lastScore: 30, confidence: 1 })
    const strong = computeTopicPriority({ ...base, status: 'COMPLETED', lastScore: 90, confidence: 5 })
    expect(weak.score).toBeGreaterThan(strong.score)
  })

  it('never exceeds 100 or drops below 0, even at the extremes', () => {
    const max = computeTopicPriority({ status: 'NOT_STARTED', importance: 5, interviewRelevance: 5, confidence: 1, lastScore: 0, daysUntilExam: 0, daysUntilInterview: 0 })
    const min = computeTopicPriority({ status: 'COMPLETED', importance: 1, interviewRelevance: 1, confidence: 5, lastScore: 100, daysUntilExam: null, daysUntilInterview: null })
    expect(max.score).toBeLessThanOrEqual(100)
    expect(min.score).toBeGreaterThanOrEqual(0)
    expect(min.score).toBeLessThan(max.score)
  })

  it('only credits interview urgency when the topic is actually interview-relevant', () => {
    const relevant = computeTopicPriority({ ...base, interviewRelevance: 4, daysUntilInterview: 2 })
    const irrelevant = computeTopicPriority({ ...base, interviewRelevance: 1, daysUntilInterview: 2 })
    expect(relevant.score).toBeGreaterThan(irrelevant.score)
    expect(irrelevant.reasons.some((x) => x.startsWith('Interview is'))).toBe(false)
  })

  it('treats an unrated confidence as a moderate (not zero) risk', () => {
    const unrated = computeTopicPriority({ ...base, confidence: null })
    const confident = computeTopicPriority({ ...base, confidence: 5 })
    const worried = computeTopicPriority({ ...base, confidence: 1 })
    expect(unrated.score).toBeGreaterThan(confident.score)
    expect(unrated.score).toBeLessThan(worried.score)
  })

  it('is a pure function: identical input always yields identical output', () => {
    const input: PriorityFactorInput = { status: 'IN_PROGRESS', importance: 4, interviewRelevance: 2, confidence: 3, lastScore: 55, daysUntilExam: 10, daysUntilInterview: null }
    expect(computeTopicPriority(input)).toEqual(computeTopicPriority(input))
  })
})

describe('estimateStudyMinutes', () => {
  it('recommends less time for lower priority and easier topics', () => {
    expect(estimateStudyMinutes(60, 'HIGH', 'ADVANCED')).toBeGreaterThan(estimateStudyMinutes(60, 'LOW', 'BEGINNER'))
  })
  it('never recommends less than 15 minutes', () => {
    expect(estimateStudyMinutes(10, 'LOW', 'BEGINNER')).toBeGreaterThanOrEqual(15)
  })
})
