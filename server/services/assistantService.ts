import { eq } from 'drizzle-orm'
import { aiService, type ChatTurn } from './aiService'
import { db, schema } from '../db/client'
import { getPrioritizedTopics } from './priorityService'
import { computeReadiness } from './readinessService'
import { listActiveRevisions } from './revisionService'

const { users, profiles } = schema

/** Builds a compact, factual snapshot of the student's real data. This is the only source of truth the assistant is allowed to speak from — it must never invent progress beyond what's here. */
async function buildContext(userId: string): Promise<string> {
  const [[user], [profile], priority, revisions, readiness] = await Promise.all([
    db.select({ name: users.name }).from(users).where(eq(users.id, userId)),
    db.select().from(profiles).where(eq(profiles.userId, userId)),
    getPrioritizedTopics(userId),
    listActiveRevisions(userId),
    computeReadiness(userId),
  ])

  const topPriority = priority.slice(0, 5).map((p) => `- ${p.topicName} (${p.subjectName}): ${p.level} priority, score ${p.score}/100. ${p.reasons[0] ?? ''}`).join('\n') || 'None yet — no subjects/topics added.'
  const topRevisions = revisions.slice(0, 5).map((r) => `- ${r.topicName} (${r.subjectName}): ${r.reason}`).join('\n') || 'None right now.'

  return [
    `Student name: ${user?.name ?? 'the student'}`,
    `Target role: ${profile?.targetRole ?? 'not set'}`,
    `Exam date: ${profile?.examDate ?? 'not set'}`,
    `Interview date: ${profile?.interviewDate ?? 'not set'}`,
    `Academic readiness: ${readiness.academic}/100. Interview readiness: ${readiness.interview}/100. Overall: ${readiness.overall}/100.`,
    `Top priority topics right now:\n${topPriority}`,
    `Topics recommended for revision:\n${topRevisions}`,
    `Recommended next steps: ${readiness.recommendedNextSteps.join('; ')}`,
  ].join('\n\n')
}

const SYSTEM_PROMPT = [
  'You are the PrepPilot study assistant. Answer only using the STUDENT DATA block provided — never invent progress, scores, or history the student has not actually recorded.',
  "If the data needed to answer isn't present in the block, say so plainly instead of guessing.",
  'Be concise, encouraging, and specific. Reference actual topic/subject names from the data when relevant.',
].join(' ')

export async function assistantChat(userId: string, history: ChatTurn[]): Promise<{ reply: string; source: 'AI' | 'FALLBACK_BANK' }> {
  const context = await buildContext(userId)
  const system = `${SYSTEM_PROMPT}\n\nSTUDENT DATA:\n${context}`
  const { data, source } = await aiService.chat(system, history)
  if (source === 'AI') return { reply: data, source }

  // Deterministic fallback: answer common questions directly from the same real data, so the assistant still works without an AI key.
  const question = (history[history.length - 1]?.content ?? '').toLowerCase()
  const [priority, revisions, readiness] = await Promise.all([getPrioritizedTopics(userId), listActiveRevisions(userId), computeReadiness(userId)])

  if (question.includes('ready') || question.includes('readiness')) {
    return { reply: `Your academic readiness is ${readiness.academic}%, interview readiness is ${readiness.interview}%, and overall preparation is ${readiness.overall}%. ${readiness.recommendedNextSteps[0] ?? ''}`, source }
  }
  if (question.includes('revis')) {
    return { reply: revisions.length === 0 ? "You have nothing flagged for revision right now — nice work." : `You should revise: ${revisions.slice(0, 3).map((r) => r.topicName).join(', ')}. ${revisions[0]?.reason ?? ''}`, source }
  }
  if (question.includes('today') || question.includes('study') || question.includes('priority')) {
    return { reply: priority.length === 0 ? "You don't have any topics yet — add a subject and some topics to get a plan." : `Based on your current priorities, focus on: ${priority.slice(0, 3).map((p) => p.topicName).join(', ')}. ${priority[0]?.reasons[0] ?? ''}`, source }
  }
  if (question.includes('interview')) {
    return { reply: `Your interview readiness is ${readiness.interview}%. ${readiness.recommendedNextSteps.find((s) => s.toLowerCase().includes('interview')) ?? 'Keep practicing questions and take a mock interview to improve this.'}`, source }
  }
  return { reply: `I can't reach the AI provider right now, so here's what I can tell you directly: your overall preparation is ${readiness.overall}%. Ask me things like "what should I study today?" or "what should I revise?" for specifics.`, source }
}
