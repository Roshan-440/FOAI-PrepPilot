/**
 * Development seed data — a realistic demo student ("Alex") with subjects, topics, quiz history,
 * a study plan, revision recommendations, interview questions, and a completed mock interview.
 * Safe to re-run: it wipes only Alex's own account (matched by email) before recreating it.
 */
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db, schema, pool } from './client'
import { hashPassword } from '../utils/password'

const { users, profiles, subjects, topics, quizAttempts, quizQuestions, quizAnswers, revisionRecommendations, studyPlans, studyTasks, interviewQuestions, mockInterviews, mockInterviewQuestions, interviewAnswers, readinessScores } = schema

const ALEX_EMAIL = 'alex@example.com'
const ALEX_PASSWORD = 'Str0ngPassw0rd'

function daysFromNow(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function dateFromNow(n: number): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + n)
  return d
}

async function main() {
  console.warn('Seeding demo data for', ALEX_EMAIL, '...')

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, ALEX_EMAIL))
  if (existing) {
    await db.delete(users).where(eq(users.id, existing.id)) // cascades to every owned table
    console.warn('Removed existing demo account to reseed cleanly.')
  }

  const passwordHash = await hashPassword(ALEX_PASSWORD)
  const [alex] = await db.insert(users).values({ name: 'Alex Johnson', email: ALEX_EMAIL, passwordHash }).returning()
  if (!alex) throw new Error('Failed to create demo user')

  await db.insert(profiles).values({
    userId: alex.id, degree: 'B.Tech', department: 'Computer Science', semester: '6', targetRole: 'Software Developer',
    targetIndustry: 'Product', availableHoursPerDay: 3, preferredSessionMinutes: 45, preferredStudyDays: [1, 2, 3, 4, 5, 6],
    examDate: daysFromNow(21), interviewDate: daysFromNow(35), onboardingCompleted: true,
  })

  // ---- Subjects & topics -------------------------------------------------
  const [ds] = await db.insert(subjects).values({ userId: alex.id, name: 'Data Structures', importance: 5, color: 'indigo', examDate: daysFromNow(21) }).returning()
  const [dbms] = await db.insert(subjects).values({ userId: alex.id, name: 'DBMS', importance: 5, color: 'emerald', examDate: daysFromNow(21) }).returning()
  const [os] = await db.insert(subjects).values({ userId: alex.id, name: 'Operating Systems', importance: 4, color: 'amber', examDate: daysFromNow(28) }).returning()
  const [cn] = await db.insert(subjects).values({ userId: alex.id, name: 'Computer Networks', importance: 3, color: 'sky' }).returning()
  if (!ds || !dbms || !os || !cn) throw new Error('Failed to create demo subjects')

  const topicRows = await db.insert(topics).values([
    { userId: alex.id, subjectId: ds.id, name: 'Arrays', status: 'COMPLETED', confidence: 5, lastScore: 92, importance: 3, interviewRelevance: 4, lastStudiedAt: dateFromNow(-10) },
    { userId: alex.id, subjectId: ds.id, name: 'Linked Lists', status: 'COMPLETED', confidence: 4, lastScore: 85, importance: 4, interviewRelevance: 5, lastStudiedAt: dateFromNow(-8) },
    { userId: alex.id, subjectId: ds.id, name: 'Trees', status: 'IN_PROGRESS', confidence: 3, lastScore: 62, importance: 5, interviewRelevance: 5, lastStudiedAt: dateFromNow(-2) },
    { userId: alex.id, subjectId: dbms.id, name: 'SQL', status: 'COMPLETED', confidence: 4, lastScore: 88, importance: 4, interviewRelevance: 5, lastStudiedAt: dateFromNow(-12) },
    { userId: alex.id, subjectId: dbms.id, name: 'Normalization', status: 'NEEDS_REVISION', confidence: 2, lastScore: 48, importance: 5, interviewRelevance: 5, lastStudiedAt: dateFromNow(-15) },
    { userId: alex.id, subjectId: dbms.id, name: 'Transactions', status: 'NOT_STARTED', confidence: null, lastScore: null, importance: 4, interviewRelevance: 4 },
    { userId: alex.id, subjectId: os.id, name: 'Processes', status: 'COMPLETED', confidence: 4, lastScore: 80, importance: 3, interviewRelevance: 3, lastStudiedAt: dateFromNow(-9) },
    { userId: alex.id, subjectId: os.id, name: 'Scheduling', status: 'IN_PROGRESS', confidence: 3, lastScore: 66, importance: 4, interviewRelevance: 4, lastStudiedAt: dateFromNow(-3) },
    { userId: alex.id, subjectId: os.id, name: 'Deadlocks', status: 'NOT_STARTED', confidence: null, lastScore: null, importance: 4, interviewRelevance: 4 },
    { userId: alex.id, subjectId: cn.id, name: 'TCP/IP', status: 'NOT_STARTED', confidence: null, lastScore: null, importance: 3, interviewRelevance: 3 },
    { userId: alex.id, subjectId: cn.id, name: 'Routing', status: 'NOT_STARTED', confidence: null, lastScore: null, importance: 2, interviewRelevance: 2 },
  ]).returning()

  const normalization = topicRows.find((t) => t.name === 'Normalization')
  const trees = topicRows.find((t) => t.name === 'Trees')
  if (!normalization || !trees) throw new Error('Failed to create demo topics')

  // ---- A submitted quiz on Normalization (the weak topic) ----------------
  const [attempt] = await db.insert(quizAttempts).values({ userId: alex.id, title: 'Quiz: Normalization', sourceType: 'TOPIC', topicId: normalization.id, status: 'SUBMITTED', score: 48, correctCount: 2, totalCount: 4, submittedAt: dateFromNow(-15) }).returning()
  if (!attempt) throw new Error('Failed to create demo quiz')
  const quizQ = await db.insert(quizQuestions).values([
    { userId: alex.id, topicId: normalization.id, type: 'MULTIPLE_CHOICE', question: 'Which normal form removes partial dependency on a composite key?', options: ['1NF', '2NF', '3NF', 'BCNF'], correctAnswer: '2NF', explanation: '2NF requires every non-key attribute to depend on the whole key, not part of it.', source: 'FALLBACK_BANK' },
    { userId: alex.id, topicId: normalization.id, type: 'TRUE_FALSE', question: 'BCNF is stricter than 3NF.', options: ['True', 'False'], correctAnswer: 'True', explanation: 'BCNF handles certain anomalies that 3NF does not.', source: 'FALLBACK_BANK' },
    { userId: alex.id, topicId: normalization.id, type: 'MULTIPLE_CHOICE', question: 'Transitive dependency is removed in which normal form?', options: ['1NF', '2NF', '3NF', 'None'], correctAnswer: '3NF', explanation: '3NF eliminates transitive dependencies on the primary key.', source: 'FALLBACK_BANK' },
    { userId: alex.id, topicId: normalization.id, type: 'SHORT_ANSWER', question: 'Briefly explain normalization in your own words.', options: null, correctAnswer: 'Normalization', explanation: 'A strong answer names reducing redundancy and dependency anomalies.', source: 'FALLBACK_BANK' },
  ]).returning()
  await db.insert(quizAnswers).values(quizQ.map((q, i) => ({ userId: alex.id, attemptId: attempt.id, questionId: q.id, position: i, answer: i < 2 ? q.correctAnswer : 'not sure', isCorrect: i < 2 })))

  // ---- Revision recommendation for the weak topic ------------------------
  await db.insert(revisionRecommendations).values({ userId: alex.id, topicId: normalization.id, reason: 'Recommended for revision because your last quiz score was 48% and your confidence level is low.', score: 78, status: 'ACTIVE' })

  // ---- A study plan with a mix of completed/pending tasks ----------------
  const [plan] = await db.insert(studyPlans).values({ userId: alex.id, title: 'Study Plan', startDate: daysFromNow(-2), endDate: daysFromNow(12), hoursPerDay: 3, studyDays: [1, 2, 3, 4, 5, 6], subjectIds: [ds.id, dbms.id, os.id], warnings: [] }).returning()
  if (plan) {
    await db.insert(studyTasks).values([
      { userId: alex.id, planId: plan.id, subjectId: ds.id, topicId: trees.id, date: daysFromNow(-1), startMinute: 1080, durationMinutes: 60, type: 'LEARN', priority: 'HIGH', reason: 'Topic is still in progress', status: 'COMPLETED', completedAt: dateFromNow(-1) },
      { userId: alex.id, planId: plan.id, subjectId: dbms.id, topicId: normalization.id, date: daysFromNow(0), startMinute: 1080, durationMinutes: 45, type: 'REVISION', priority: 'HIGH', reason: 'Revisiting because your last quiz score was 48%.', status: 'PENDING' },
      { userId: alex.id, planId: plan.id, subjectId: os.id, topicId: topicRows.find((t) => t.name === 'Scheduling')?.id ?? null, date: daysFromNow(1), startMinute: 1080, durationMinutes: 60, type: 'LEARN', priority: 'MEDIUM', reason: 'Topic is still in progress', status: 'PENDING' },
      { userId: alex.id, planId: plan.id, subjectId: dbms.id, topicId: null, date: daysFromNow(1), startMinute: 1140, durationMinutes: 25, type: 'QUIZ', priority: 'MEDIUM', reason: 'Quick check on what you studied in this subject.', status: 'PENDING' },
    ])
  }

  // ---- Interview questions + a completed mock interview -------------------
  const iq = await db.insert(interviewQuestions).values([
    { userId: alex.id, role: 'Software Developer', category: 'TECHNICAL', difficulty: 'INTERMEDIATE', topic: 'Data Structures', question: 'What is the time complexity of common operations on the data structures you have used most?', testing: 'Understanding of fundamental data structure trade-offs.', keyPoints: ['time complexity', 'space complexity', 'use case trade-offs'], source: 'FALLBACK_BANK' },
    { userId: alex.id, role: 'Software Developer', category: 'HR', difficulty: 'BEGINNER', topic: 'Introduction', question: 'Tell me about yourself.', testing: 'Communication clarity and self-awareness.', keyPoints: ['relevant background', 'concise structure', 'connection to the role'], source: 'FALLBACK_BANK' },
  ]).returning()
  await db.insert(interviewAnswers).values({ userId: alex.id, interviewQuestionId: iq[0]?.id, answer: 'Arrays give O(1) access but O(n) insertion; linked lists give O(1) insertion but O(n) access...', scores: { correctness: 80, relevance: 85, completeness: 75, clarity: 80, depth: 70, communication: 82 }, overallScore: 79, feedback: 'Solid coverage of trade-offs — add a concrete example next time.', evaluationSource: 'FALLBACK_BANK' })

  const [mock] = await db.insert(mockInterviews).values({ userId: alex.id, role: 'Software Developer', type: 'MIXED', difficulty: 'INTERMEDIATE', questionCount: 3, status: 'COMPLETED', overallScore: 74, startedAt: dateFromNow(-6), completedAt: dateFromNow(-6), report: { overallScore: 74, strengths: ['Data Structures', 'Introduction'], weaknesses: ['Normalization'], recommendedTopics: ['Normalization'], suggestedImprovements: ['Structure answers with a clear situation, action, and result.', 'Review key points before your next attempt.'] } }).returning()
  if (mock) {
    const miq = await db.insert(mockInterviewQuestions).values([
      { userId: alex.id, mockInterviewId: mock.id, position: 1, category: 'TECHNICAL', topic: 'Data Structures', question: 'Explain how a hash map achieves average O(1) lookup.', keyPoints: ['hashing', 'collision handling', 'load factor'], source: 'FALLBACK_BANK' },
      { userId: alex.id, mockInterviewId: mock.id, position: 2, category: 'HR', topic: 'Introduction', question: 'Tell me about yourself.', keyPoints: ['relevant background', 'concise structure'], source: 'FALLBACK_BANK' },
      { userId: alex.id, mockInterviewId: mock.id, position: 3, category: 'TECHNICAL', topic: 'DBMS', question: 'Explain normalization and when you might denormalize.', keyPoints: ['normalization', 'redundancy', 'query performance trade-offs'], source: 'FALLBACK_BANK' },
    ]).returning()
    await db.insert(interviewAnswers).values([
      { userId: alex.id, mockInterviewQuestionId: miq[0]?.id, answer: 'A hash map uses a hash function to map keys to buckets...', scores: { correctness: 85, relevance: 85, completeness: 80, clarity: 82, depth: 78, communication: 80 }, overallScore: 82, feedback: 'Clear and mostly complete.', evaluationSource: 'FALLBACK_BANK' },
      { userId: alex.id, mockInterviewQuestionId: miq[1]?.id, answer: "I'm a final-year CS student focused on backend development...", scores: { correctness: 80, relevance: 85, completeness: 75, clarity: 85, depth: 60, communication: 85 }, overallScore: 78, feedback: 'Good structure, could use a specific example.', evaluationSource: 'FALLBACK_BANK' },
      { userId: alex.id, mockInterviewQuestionId: miq[2]?.id, answer: "Normalization organizes data to reduce redundancy, I don't remember all the normal forms though.", scores: { correctness: 45, relevance: 60, completeness: 40, clarity: 55, depth: 30, communication: 60 }, overallScore: 48, feedback: 'Missed the specific normal forms and trade-offs — worth revisiting.', evaluationSource: 'FALLBACK_BANK' },
    ])
  }

  // ---- A readiness snapshot so the trend chart has a starting point -------
  await db.insert(readinessScores).values({ userId: alex.id, academic: 58, interview: 62, overall: 60, factors: { note: 'seed snapshot' } })

  console.warn(`\nDone. Sign in with: ${ALEX_EMAIL} / ${ALEX_PASSWORD}`)
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  .finally(async () => { await pool.end() })
