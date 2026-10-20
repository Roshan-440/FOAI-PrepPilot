CREATE TYPE "public"."content_source" AS ENUM('AI', 'FALLBACK_BANK', 'USER');--> statement-breakpoint
CREATE TYPE "public"."difficulty_level" AS ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED');--> statement-breakpoint
CREATE TYPE "public"."interview_category" AS ENUM('TECHNICAL', 'HR', 'BEHAVIORAL', 'PROJECT');--> statement-breakpoint
CREATE TYPE "public"."mock_interview_status" AS ENUM('IN_PROGRESS', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."mock_interview_type" AS ENUM('TECHNICAL', 'HR', 'MIXED');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."priority_level" AS ENUM('HIGH', 'MEDIUM', 'LOW');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER');--> statement-breakpoint
CREATE TYPE "public"."quiz_attempt_status" AS ENUM('IN_PROGRESS', 'SUBMITTED');--> statement-breakpoint
CREATE TYPE "public"."revision_status" AS ENUM('ACTIVE', 'DONE', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('PENDING', 'COMPLETED', 'MISSED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('LEARN', 'PRACTICE', 'QUIZ', 'REVISION', 'INTERVIEW');--> statement-breakpoint
CREATE TYPE "public"."topic_status" AS ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'NEEDS_REVISION');--> statement-breakpoint
CREATE TABLE "interview_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mock_interview_question_id" uuid,
	"interview_question_id" uuid,
	"answer" text NOT NULL,
	"scores" jsonb NOT NULL,
	"overall_score" integer NOT NULL,
	"feedback" text DEFAULT '' NOT NULL,
	"evaluation_source" "content_source" DEFAULT 'FALLBACK_BANK' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ia_score_chk" CHECK ("interview_answers"."overall_score" between 0 and 100),
	CONSTRAINT "ia_target_chk" CHECK (("interview_answers"."mock_interview_question_id" is not null)::int + ("interview_answers"."interview_question_id" is not null)::int = 1)
);
--> statement-breakpoint
CREATE TABLE "interview_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"role" text,
	"category" "interview_category" NOT NULL,
	"difficulty" "difficulty_level" NOT NULL,
	"topic" text NOT NULL,
	"question" text NOT NULL,
	"testing" text NOT NULL,
	"key_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" "content_source" DEFAULT 'FALLBACK_BANK' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mock_interview_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mock_interview_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"category" "interview_category" NOT NULL,
	"topic" text NOT NULL,
	"question" text NOT NULL,
	"key_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" "content_source" DEFAULT 'FALLBACK_BANK' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mock_interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"type" "mock_interview_type" NOT NULL,
	"difficulty" "difficulty_level" NOT NULL,
	"question_count" integer NOT NULL,
	"status" "mock_interview_status" DEFAULT 'IN_PROGRESS' NOT NULL,
	"overall_score" integer,
	"report" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "mi_count_chk" CHECK ("mock_interviews"."question_count" between 1 and 20),
	CONSTRAINT "mi_score_chk" CHECK ("mock_interviews"."overall_score" is null or "mock_interviews"."overall_score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"degree" text,
	"department" text,
	"semester" text,
	"target_role" text,
	"target_industry" text,
	"available_hours_per_day" real,
	"preferred_session_minutes" integer,
	"preferred_study_days" integer[],
	"exam_date" date,
	"interview_date" date,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"answer" text,
	"is_correct" boolean
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"source_type" text NOT NULL,
	"subject_id" uuid,
	"topic_id" uuid,
	"status" "quiz_attempt_status" DEFAULT 'IN_PROGRESS' NOT NULL,
	"score" integer,
	"correct_count" integer,
	"total_count" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	CONSTRAINT "qa_score_chk" CHECK ("quiz_attempts"."score" is null or "quiz_attempts"."score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"type" "question_type" NOT NULL,
	"question" text NOT NULL,
	"options" jsonb,
	"correct_answer" text NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"difficulty" "difficulty_level" DEFAULT 'INTERMEDIATE' NOT NULL,
	"source" "content_source" DEFAULT 'FALLBACK_BANK' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "readiness_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"academic" integer NOT NULL,
	"interview" integer NOT NULL,
	"overall" integer NOT NULL,
	"factors" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rs_range_chk" CHECK ("readiness_scores"."academic" between 0 and 100 and "readiness_scores"."interview" between 0 and 100 and "readiness_scores"."overall" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "revision_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"score" real NOT NULL,
	"status" "revision_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"category" text
);
--> statement-breakpoint
CREATE TABLE "study_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"goal" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"hours_per_day" real NOT NULL,
	"study_days" integer[] NOT NULL,
	"subject_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"status" "plan_status" DEFAULT 'ACTIVE' NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_dates_chk" CHECK ("study_plans"."end_date" >= "study_plans"."start_date"),
	CONSTRAINT "plans_hours_chk" CHECK ("study_plans"."hours_per_day" > 0 and "study_plans"."hours_per_day" <= 16)
);
--> statement-breakpoint
CREATE TABLE "study_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"task_id" uuid,
	"topic_id" uuid,
	"studied_on" date NOT NULL,
	"duration_minutes" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_sessions_duration_chk" CHECK ("study_sessions"."duration_minutes" > 0 and "study_sessions"."duration_minutes" <= 1440)
);
--> statement-breakpoint
CREATE TABLE "study_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"subject_id" uuid,
	"topic_id" uuid,
	"date" date NOT NULL,
	"start_minute" integer NOT NULL,
	"duration_minutes" integer NOT NULL,
	"type" "task_type" NOT NULL,
	"priority" "priority_level" DEFAULT 'MEDIUM' NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"status" "task_status" DEFAULT 'PENDING' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_duration_chk" CHECK ("study_tasks"."duration_minutes" > 0 and "study_tasks"."duration_minutes" <= 720),
	CONSTRAINT "tasks_start_chk" CHECK ("study_tasks"."start_minute" >= 0 and "study_tasks"."start_minute" < 1440)
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"importance" integer DEFAULT 3 NOT NULL,
	"exam_date" date,
	"color" text DEFAULT 'indigo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subjects_importance_chk" CHECK ("subjects"."importance" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"difficulty" "difficulty_level" DEFAULT 'INTERMEDIATE' NOT NULL,
	"importance" integer DEFAULT 3 NOT NULL,
	"interview_relevance" integer DEFAULT 3 NOT NULL,
	"estimated_minutes" integer DEFAULT 60 NOT NULL,
	"status" "topic_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"confidence" integer,
	"last_studied_at" timestamp with time zone,
	"last_score" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topics_importance_chk" CHECK ("topics"."importance" between 1 and 5),
	CONSTRAINT "topics_relevance_chk" CHECK ("topics"."interview_relevance" between 1 and 5),
	CONSTRAINT "topics_confidence_chk" CHECK ("topics"."confidence" is null or "topics"."confidence" between 1 and 5),
	CONSTRAINT "topics_score_chk" CHECK ("topics"."last_score" is null or "topics"."last_score" between 0 and 100),
	CONSTRAINT "topics_minutes_chk" CHECK ("topics"."estimated_minutes" between 5 and 1440)
);
--> statement-breakpoint
CREATE TABLE "user_skills" (
	"user_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_skills_user_id_skill_id_pk" PRIMARY KEY("user_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_mock_interview_question_id_mock_interview_questions_id_fk" FOREIGN KEY ("mock_interview_question_id") REFERENCES "public"."mock_interview_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_interview_question_id_interview_questions_id_fk" FOREIGN KEY ("interview_question_id") REFERENCES "public"."interview_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_interview_questions" ADD CONSTRAINT "mock_interview_questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_interview_questions" ADD CONSTRAINT "mock_interview_questions_mock_interview_id_mock_interviews_id_fk" FOREIGN KEY ("mock_interview_id") REFERENCES "public"."mock_interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_interviews" ADD CONSTRAINT "mock_interviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_attempt_id_quiz_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_question_id_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness_scores" ADD CONSTRAINT "readiness_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_recommendations" ADD CONSTRAINT "revision_recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_recommendations" ADD CONSTRAINT "revision_recommendations_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_plans" ADD CONSTRAINT "study_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_task_id_study_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."study_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_tasks" ADD CONSTRAINT "study_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_tasks" ADD CONSTRAINT "study_tasks_plan_id_study_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."study_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_tasks" ADD CONSTRAINT "study_tasks_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_tasks" ADD CONSTRAINT "study_tasks_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ia_user_idx" ON "interview_answers" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ia_mock_question_uq" ON "interview_answers" USING btree ("mock_interview_question_id");--> statement-breakpoint
CREATE INDEX "iq_user_idx" ON "interview_questions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "iq_filter_idx" ON "interview_questions" USING btree ("category","difficulty");--> statement-breakpoint
CREATE UNIQUE INDEX "miq_position_uq" ON "mock_interview_questions" USING btree ("mock_interview_id","position");--> statement-breakpoint
CREATE INDEX "mi_user_idx" ON "mock_interviews" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "notif_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "prt_token_hash_uq" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "prt_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "qans_attempt_question_uq" ON "quiz_answers" USING btree ("attempt_id","question_id");--> statement-breakpoint
CREATE INDEX "qans_attempt_idx" ON "quiz_answers" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "qa_user_idx" ON "quiz_attempts" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "qq_user_topic_idx" ON "quiz_questions" USING btree ("user_id","topic_id");--> statement-breakpoint
CREATE INDEX "rs_user_time_idx" ON "readiness_scores" USING btree ("user_id","computed_at");--> statement-breakpoint
CREATE INDEX "rev_user_status_idx" ON "revision_recommendations" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "rev_active_topic_uq" ON "revision_recommendations" USING btree ("topic_id") WHERE "revision_recommendations"."status" = 'ACTIVE';--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_uq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "skills_name_uq" ON "skills" USING btree ("name");--> statement-breakpoint
CREATE INDEX "plans_user_status_idx" ON "study_plans" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "sessions_user_day_idx" ON "study_sessions" USING btree ("user_id","studied_on");--> statement-breakpoint
CREATE INDEX "tasks_user_date_idx" ON "study_tasks" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "tasks_plan_idx" ON "study_tasks" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "tasks_topic_idx" ON "study_tasks" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_user_name_uq" ON "subjects" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE INDEX "subjects_user_idx" ON "subjects" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "topics_subject_name_uq" ON "topics" USING btree ("subject_id",lower("name"));--> statement-breakpoint
CREATE INDEX "topics_user_idx" ON "topics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "topics_subject_idx" ON "topics" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "topics_user_status_idx" ON "topics" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");