import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * PrepPilot schema.
 *
 * Ownership rule: every student-owned table has a non-null `user_id` FK with
 * ON DELETE CASCADE. Services MUST always filter by the authenticated user's id
 * (never trust ids sent by the client). The only table with nullable `user_id`
 * is `interview_questions`, where NULL marks the shared global question bank.
 */

// ---------- Enums ----------
export const topicStatus = pgEnum('topic_status', ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'NEEDS_REVISION'])
export const difficultyLevel = pgEnum('difficulty_level', ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'])
export const taskType = pgEnum('task_type', ['LEARN', 'PRACTICE', 'QUIZ', 'REVISION', 'INTERVIEW'])
export const taskStatus = pgEnum('task_status', ['PENDING', 'COMPLETED', 'MISSED', 'SKIPPED'])
export const priorityLevel = pgEnum('priority_level', ['HIGH', 'MEDIUM', 'LOW'])
export const planStatus = pgEnum('plan_status', ['ACTIVE', 'ARCHIVED'])
export const questionType = pgEnum('question_type', ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER'])
export const quizAttemptStatus = pgEnum('quiz_attempt_status', ['IN_PROGRESS', 'SUBMITTED'])
export const interviewCategory = pgEnum('interview_category', ['TECHNICAL', 'HR', 'BEHAVIORAL', 'PROJECT'])
export const mockInterviewType = pgEnum('mock_interview_type', ['TECHNICAL', 'HR', 'MIXED'])
export const mockInterviewStatus = pgEnum('mock_interview_status', ['IN_PROGRESS', 'COMPLETED'])
export const contentSource = pgEnum('content_source', ['AI', 'FALLBACK_BANK', 'USER'])
export const revisionStatus = pgEnum('revision_status', ['ACTIVE', 'DONE', 'DISMISSED'])

const id = () => uuid('id').primaryKey().defaultRandom()
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const userRef = (name = 'user_id') =>
  uuid(name)
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })

// ---------- Auth ----------
export const users = pgTable(
  'users',
  {
    id: id(),
    email: text('email').notNull(), // always stored lower-cased
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_email_uq').on(t.email)],
)

/** Server-side sessions. Only the SHA-256 hash of the cookie token is stored. */
export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: userRef(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('sessions_token_hash_uq').on(t.tokenHash), index('sessions_user_idx').on(t.userId)],
)

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: id(),
    userId: userRef(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('prt_token_hash_uq').on(t.tokenHash), index('prt_user_idx').on(t.userId)],
)

// ---------- Profile & skills ----------
export const profiles = pgTable('profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  degree: text('degree'),
  department: text('department'),
  semester: text('semester'),
  targetRole: text('target_role'),
  targetIndustry: text('target_industry'),
  availableHoursPerDay: real('available_hours_per_day'),
  preferredSessionMinutes: integer('preferred_session_minutes'),
  /** ISO weekdays, 1 = Monday ... 7 = Sunday */
  preferredStudyDays: integer('preferred_study_days').array(),
  examDate: date('exam_date'),
  interviewDate: date('interview_date'),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const skills = pgTable(
  'skills',
  {
    id: id(),
    name: text('name').notNull(), // stored lower-cased for de-duplication
    displayName: text('display_name').notNull(),
    category: text('category'), // e.g. "language", "technology"
  },
  (t) => [uniqueIndex('skills_name_uq').on(t.name)],
)

export const userSkills = pgTable(
  'user_skills',
  {
    userId: userRef(),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.skillId] })],
)

// ---------- Subjects & topics ----------
export const subjects = pgTable(
  'subjects',
  {
    id: id(),
    userId: userRef(),
    name: text('name').notNull(),
    description: text('description'),
    importance: integer('importance').notNull().default(3),
    examDate: date('exam_date'),
    color: text('color').notNull().default('indigo'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('subjects_user_name_uq').on(t.userId, sql`lower(${t.name})`),
    index('subjects_user_idx').on(t.userId),
    check('subjects_importance_chk', sql`${t.importance} between 1 and 5`),
  ],
)

export const topics = pgTable(
  'topics',
  {
    id: id(),
    userId: userRef(),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    difficulty: difficultyLevel('difficulty').notNull().default('INTERMEDIATE'),
    importance: integer('importance').notNull().default(3),
    interviewRelevance: integer('interview_relevance').notNull().default(3),
    estimatedMinutes: integer('estimated_minutes').notNull().default(60),
    status: topicStatus('status').notNull().default('NOT_STARTED'),
    /** Self-assessed confidence, 1 (low) .. 5 (high). NULL = not rated yet. */
    confidence: integer('confidence'),
    lastStudiedAt: timestamp('last_studied_at', { withTimezone: true }),
    /** Most recent quiz score for this topic, 0..100. NULL = never assessed. */
    lastScore: integer('last_score'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('topics_subject_name_uq').on(t.subjectId, sql`lower(${t.name})`),
    index('topics_user_idx').on(t.userId),
    index('topics_subject_idx').on(t.subjectId),
    index('topics_user_status_idx').on(t.userId, t.status),
    check('topics_importance_chk', sql`${t.importance} between 1 and 5`),
    check('topics_relevance_chk', sql`${t.interviewRelevance} between 1 and 5`),
    check('topics_confidence_chk', sql`${t.confidence} is null or ${t.confidence} between 1 and 5`),
    check('topics_score_chk', sql`${t.lastScore} is null or ${t.lastScore} between 0 and 100`),
    check('topics_minutes_chk', sql`${t.estimatedMinutes} between 5 and 1440`),
  ],
)

// ---------- Planning ----------
export const studyPlans = pgTable(
  'study_plans',
  {
    id: id(),
    userId: userRef(),
    title: text('title').notNull(),
    goal: text('goal'),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    hoursPerDay: real('hours_per_day').notNull(),
    studyDays: integer('study_days').array().notNull(),
    subjectIds: uuid('subject_ids').array().notNull().default(sql`'{}'::uuid[]`),
    status: planStatus('status').notNull().default('ACTIVE'),
    /** Human-readable notes, e.g. "Not all topics fit in the available time". */
    warnings: jsonb('warnings').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [
    index('plans_user_status_idx').on(t.userId, t.status),
    check('plans_dates_chk', sql`${t.endDate} >= ${t.startDate}`),
    check('plans_hours_chk', sql`${t.hoursPerDay} > 0 and ${t.hoursPerDay} <= 16`),
  ],
)

export const studyTasks = pgTable(
  'study_tasks',
  {
    id: id(),
    userId: userRef(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => studyPlans.id, { onDelete: 'cascade' }),
    subjectId: uuid('subject_id').references(() => subjects.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    /** Minutes after midnight (e.g. 9:30 = 570). */
    startMinute: integer('start_minute').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    type: taskType('type').notNull(),
    priority: priorityLevel('priority').notNull().default('MEDIUM'),
    reason: text('reason').notNull().default(''),
    status: taskStatus('status').notNull().default('PENDING'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('tasks_user_date_idx').on(t.userId, t.date),
    index('tasks_plan_idx').on(t.planId),
    index('tasks_topic_idx').on(t.topicId),
    check('tasks_duration_chk', sql`${t.durationMinutes} > 0 and ${t.durationMinutes} <= 720`),
    check('tasks_start_chk', sql`${t.startMinute} >= 0 and ${t.startMinute} < 1440`),
  ],
)

/** Actual time the student studied (feeds "today's study hours" and streaks). */
export const studySessions = pgTable(
  'study_sessions',
  {
    id: id(),
    userId: userRef(),
    taskId: uuid('task_id').references(() => studyTasks.id, { onDelete: 'set null' }),
    topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'set null' }),
    studiedOn: date('studied_on').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    notes: text('notes'),
    createdAt: createdAt(),
  },
  (t) => [
    index('sessions_user_day_idx').on(t.userId, t.studiedOn),
    check('study_sessions_duration_chk', sql`${t.durationMinutes} > 0 and ${t.durationMinutes} <= 1440`),
  ],
)

// ---------- Quizzes ----------
export const quizQuestions = pgTable(
  'quiz_questions',
  {
    id: id(),
    userId: userRef(),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    type: questionType('type').notNull(),
    question: text('question').notNull(),
    options: jsonb('options').$type<string[] | null>(),
    /** Never sent to the client before the attempt is submitted. */
    correctAnswer: text('correct_answer').notNull(),
    explanation: text('explanation').notNull().default(''),
    difficulty: difficultyLevel('difficulty').notNull().default('INTERMEDIATE'),
    source: contentSource('source').notNull().default('FALLBACK_BANK'),
    createdAt: createdAt(),
  },
  (t) => [index('qq_user_topic_idx').on(t.userId, t.topicId)],
)

export const quizAttempts = pgTable(
  'quiz_attempts',
  {
    id: id(),
    userId: userRef(),
    title: text('title').notNull(),
    sourceType: text('source_type').notNull(), // TOPIC | SUBJECT | WEAK | MIXED
    subjectId: uuid('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
    topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'set null' }),
    status: quizAttemptStatus('status').notNull().default('IN_PROGRESS'),
    /** Computed server-side on submit. 0..100. */
    score: integer('score'),
    correctCount: integer('correct_count'),
    totalCount: integer('total_count').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
  },
  (t) => [
    index('qa_user_idx').on(t.userId, t.startedAt),
    check('qa_score_chk', sql`${t.score} is null or ${t.score} between 0 and 100`),
  ],
)

export const quizAnswers = pgTable(
  'quiz_answers',
  {
    id: id(),
    userId: userRef(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => quizAttempts.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => quizQuestions.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    answer: text('answer'),
    isCorrect: boolean('is_correct'),
  },
  (t) => [uniqueIndex('qans_attempt_question_uq').on(t.attemptId, t.questionId), index('qans_attempt_idx').on(t.attemptId)],
)

export const revisionRecommendations = pgTable(
  'revision_recommendations',
  {
    id: id(),
    userId: userRef(),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    score: real('score').notNull(),
    status: revisionStatus('status').notNull().default('ACTIVE'),
    createdAt: createdAt(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [
    index('rev_user_status_idx').on(t.userId, t.status),
    // At most one ACTIVE recommendation per topic.
    uniqueIndex('rev_active_topic_uq').on(t.topicId).where(sql`${t.status} = 'ACTIVE'`),
  ],
)

// ---------- Interviews ----------
export const interviewQuestions = pgTable(
  'interview_questions',
  {
    id: id(),
    /** NULL = shared global fallback bank. */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    role: text('role'),
    category: interviewCategory('category').notNull(),
    difficulty: difficultyLevel('difficulty').notNull(),
    topic: text('topic').notNull(),
    question: text('question').notNull(),
    testing: text('testing').notNull(),
    keyPoints: jsonb('key_points').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    source: contentSource('source').notNull().default('FALLBACK_BANK'),
    createdAt: createdAt(),
  },
  (t) => [index('iq_user_idx').on(t.userId), index('iq_filter_idx').on(t.category, t.difficulty)],
)

export const mockInterviews = pgTable(
  'mock_interviews',
  {
    id: id(),
    userId: userRef(),
    role: text('role').notNull(),
    type: mockInterviewType('type').notNull(),
    difficulty: difficultyLevel('difficulty').notNull(),
    questionCount: integer('question_count').notNull(),
    status: mockInterviewStatus('status').notNull().default('IN_PROGRESS'),
    overallScore: integer('overall_score'),
    report: jsonb('report').$type<Record<string, unknown> | null>(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    index('mi_user_idx').on(t.userId, t.startedAt),
    check('mi_count_chk', sql`${t.questionCount} between 1 and 20`),
    check('mi_score_chk', sql`${t.overallScore} is null or ${t.overallScore} between 0 and 100`),
  ],
)

export const mockInterviewQuestions = pgTable(
  'mock_interview_questions',
  {
    id: id(),
    userId: userRef(),
    mockInterviewId: uuid('mock_interview_id')
      .notNull()
      .references(() => mockInterviews.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    category: interviewCategory('category').notNull(),
    topic: text('topic').notNull(),
    question: text('question').notNull(),
    keyPoints: jsonb('key_points').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    source: contentSource('source').notNull().default('FALLBACK_BANK'),
  },
  (t) => [uniqueIndex('miq_position_uq').on(t.mockInterviewId, t.position)],
)

export const interviewAnswers = pgTable(
  'interview_answers',
  {
    id: id(),
    userId: userRef(),
    mockInterviewQuestionId: uuid('mock_interview_question_id').references(() => mockInterviewQuestions.id, {
      onDelete: 'cascade',
    }),
    interviewQuestionId: uuid('interview_question_id').references(() => interviewQuestions.id, {
      onDelete: 'cascade',
    }),
    answer: text('answer').notNull(),
    /** Per-dimension scores 0..100: correctness, relevance, completeness, clarity, depth, communication. */
    scores: jsonb('scores').$type<Record<string, number>>().notNull(),
    overallScore: integer('overall_score').notNull(),
    feedback: text('feedback').notNull().default(''),
    evaluationSource: contentSource('evaluation_source').notNull().default('FALLBACK_BANK'),
    createdAt: createdAt(),
  },
  (t) => [
    index('ia_user_idx').on(t.userId, t.createdAt),
    uniqueIndex('ia_mock_question_uq').on(t.mockInterviewQuestionId),
    check('ia_score_chk', sql`${t.overallScore} between 0 and 100`),
    check(
      'ia_target_chk',
      sql`(${t.mockInterviewQuestionId} is not null)::int + (${t.interviewQuestionId} is not null)::int = 1`,
    ),
  ],
)

// ---------- Readiness & notifications ----------
export const readinessScores = pgTable(
  'readiness_scores',
  {
    id: id(),
    userId: userRef(),
    academic: integer('academic').notNull(),
    interview: integer('interview').notNull(),
    overall: integer('overall').notNull(),
    factors: jsonb('factors').$type<Record<string, unknown>>().notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('rs_user_time_idx').on(t.userId, t.computedAt),
    check('rs_range_chk', sql`${t.academic} between 0 and 100 and ${t.interview} between 0 and 100 and ${t.overall} between 0 and 100`),
  ],
)

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: userRef(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('notif_user_idx').on(t.userId, t.createdAt)],
)
