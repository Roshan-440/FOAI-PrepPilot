/**
 * AI service abstraction. Every AI-backed feature in PrepPilot goes through this module so the app is never
 * tightly coupled to one provider, never fabricates a successful AI response when the call actually failed,
 * and stays fully usable (via a deterministic fallback) when no provider key is configured.
 *
 * Provider is chosen by AI_PROVIDER / AI_API_KEY (server-only env vars — never sent to the client).
 */
import { env } from '../config/env'

export type AiSource = 'AI' | 'FALLBACK_BANK'
export interface AiResult<T> { data: T; source: AiSource }

export interface GeneratedQuizQuestion {
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER'
  question: string
  options: string[] | null
  correctAnswer: string
  explanation: string
}

export interface GeneratedInterviewQuestion {
  category: 'TECHNICAL' | 'HR' | 'BEHAVIORAL' | 'PROJECT'
  topic: string
  question: string
  testing: string
  keyPoints: string[]
}

export interface AnswerEvaluation {
  scores: { correctness: number; relevance: number; completeness: number; clarity: number; depth: number; communication: number }
  overallScore: number
  feedback: string
}

export interface ChatTurn { role: 'user' | 'assistant'; content: string }

interface AiProvider {
  readonly name: AiSource extends never ? never : 'anthropic' | 'openai' | 'mock'
  generateQuizQuestions(topic: string, subject: string, difficulty: string, count: number): Promise<GeneratedQuizQuestion[]>
  generateInterviewQuestions(role: string, category: string, difficulty: string, count: number, context: { skills: string[]; subjects: string[] }): Promise<GeneratedInterviewQuestion[]>
  evaluateInterviewAnswer(question: string, keyPoints: string[], answer: string): Promise<AnswerEvaluation>
  chat(system: string, history: ChatTurn[]): Promise<string>
}

// ---------------------------------------------------------------------------
// Deterministic mock provider — used whenever no real key is configured, and
// automatically used as a fallback if a real provider call fails or times out.
// ---------------------------------------------------------------------------
const TEMPLATES = {
  mcqStems: (topic: string) => [
    `Which statement best describes ${topic}?`,
    `In the context of ${topic}, which of the following is most accurate?`,
    `What is the primary purpose of ${topic}?`,
  ],
  tfStems: (topic: string) => [`${topic} is a concept typically covered at an introductory level.`, `Understanding ${topic} generally requires prior knowledge of related fundamentals.`],
  shortStems: (topic: string) => [`Briefly explain ${topic} in your own words, including one real-world example.`, `Describe a situation where knowledge of ${topic} would be useful, and why.`],
}

function seededPick<T>(items: T[], seed: number): T {
  const item = items[Math.abs(seed) % items.length]
  if (item === undefined) throw new Error('seededPick called with an empty array')
  return item
}
function hash(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0
  return h
}

class MockProvider implements AiProvider {
  readonly name = 'mock' as const

  async generateQuizQuestions(topic: string, subject: string, difficulty: string, count: number): Promise<GeneratedQuizQuestion[]> {
    const out: GeneratedQuizQuestion[] = []
    for (let i = 0; i < count; i++) {
      const seed = hash(`${topic}-${i}-${difficulty}`)
      const kind = i % 3
      if (kind === 0) {
        const correct = `A concept central to ${subject} that ${topic.toLowerCase()} directly relates to`
        const options = [
          correct,
          `Something unrelated to ${subject}`,
          `A deprecated approach no longer used in ${subject}`,
          `A term specific to an entirely different field`,
        ]
        out.push({ type: 'MULTIPLE_CHOICE', question: seededPick(TEMPLATES.mcqStems(topic), seed), options: shuffleDeterministic(options, seed), correctAnswer: correct, explanation: `${topic} is best understood as a core idea within ${subject}, which is why this option is correct.` })
      } else if (kind === 1) {
        const statementTrue = seed % 2 === 0
        out.push({ type: 'TRUE_FALSE', question: seededPick(TEMPLATES.tfStems(topic), seed), options: ['True', 'False'], correctAnswer: statementTrue ? 'True' : 'False', explanation: `This reflects how ${topic} is typically introduced within ${subject} courses.` })
      } else {
        out.push({ type: 'SHORT_ANSWER', question: seededPick(TEMPLATES.shortStems(topic), seed), options: null, correctAnswer: topic, explanation: `A strong answer names the core idea of ${topic} and connects it to a concrete example.` })
      }
    }
    return out
  }

  async generateInterviewQuestions(role: string, category: string, difficulty: string, count: number, context: { skills: string[]; subjects: string[] }): Promise<GeneratedInterviewQuestion[]> {
    const bank = fallbackInterviewBank(role, category as GeneratedInterviewQuestion['category'], difficulty, context)
    return bank.slice(0, count)
  }

  async evaluateInterviewAnswer(_question: string, keyPoints: string[], answer: string): Promise<AnswerEvaluation> {
    const trimmed = answer.trim()
    const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length
    const lower = trimmed.toLowerCase()
    const hits = keyPoints.filter((kp) => lower.includes((kp.toLowerCase().split(' ')[0] ?? kp.toLowerCase()))).length
    const coverage = keyPoints.length === 0 ? 0.5 : hits / keyPoints.length
    const lengthScore = Math.min(1, words / 60)
    const completeness = Math.round((coverage * 0.7 + lengthScore * 0.3) * 100)
    const clarity = Math.round(Math.min(100, 40 + Math.min(words, 120) / 2))
    const correctness = Math.round(coverage * 100)
    const relevance = Math.round(Math.min(100, 50 + coverage * 50))
    const depth = Math.round(Math.min(100, words > 40 ? coverage * 90 : coverage * 60))
    const communication = Math.round((clarity + Math.min(100, 100 - Math.abs(80 - Math.min(words, 160)))) / 2)
    const overallScore = Math.round((correctness + relevance + completeness + clarity + depth + communication) / 6)
    const feedback =
      words === 0
        ? 'No answer was submitted, so this could not be evaluated on content — only completeness.'
        : coverage >= 0.6
          ? `Good coverage of the key points expected for this question. Consider adding a concrete example to strengthen depth.`
          : `This answer misses some of the key points interviewers would look for. Review: ${keyPoints.slice(0, 2).join('; ') || 'the core concept behind this question'}.`
    return { scores: { correctness, relevance, completeness, clarity, depth, communication }, overallScore, feedback }
  }

  async chat(_system: string, history: ChatTurn[]): Promise<string> {
    const last = history[history.length - 1]?.content ?? ''
    return `I can't reach the AI provider right now, so here's what I can tell you from your data directly: ${last.length > 0 ? 'see the summary above.' : 'ask me something specific, like "what should I study today?"'}`
  }
}

function shuffleDeterministic<T>(items: T[], seed: number): T[] {
  const arr = [...items]
  let s = seed
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) | 0
    const j = Math.abs(s) % (i + 1)
    const tmp = arr[i] as T
    arr[i] = arr[j] as T
    arr[j] = tmp
  }
  return arr
}

function fallbackInterviewBank(role: string, category: GeneratedInterviewQuestion['category'], difficulty: string, context: { skills: string[]; subjects: string[] }): GeneratedInterviewQuestion[] {
  const skill = context.skills[0] ?? 'your primary technology'
  const subject = context.subjects[0] ?? 'your core subject area'
  const byCategory: Record<GeneratedInterviewQuestion['category'], GeneratedInterviewQuestion[]> = {
    TECHNICAL: [
      { category: 'TECHNICAL', topic: 'Data Structures', question: `What is the time complexity of common operations on the data structures you've used most, and when would you choose one over another?`, testing: 'Understanding of fundamental data structure trade-offs.', keyPoints: ['time complexity', 'space complexity', 'use case trade-offs'] },
      { category: 'TECHNICAL', topic: 'Databases', question: `Explain normalization and when you might deliberately denormalize a schema.`, testing: 'Database design fundamentals.', keyPoints: ['normalization', 'redundancy', 'query performance trade-offs'] },
      { category: 'TECHNICAL', topic: skill, question: `Walk through how you would debug a performance issue in a project that uses ${skill}.`, testing: 'Practical debugging methodology.', keyPoints: ['profiling', 'bottleneck identification', 'iterative testing'] },
      { category: 'TECHNICAL', topic: 'Operating Systems', question: `Explain the difference between a process and a thread, and a situation where you'd prefer one over the other.`, testing: 'OS fundamentals.', keyPoints: ['process isolation', 'shared memory', 'context switching cost'] },
      { category: 'TECHNICAL', topic: 'Networks', question: `Describe what happens, step by step, when you type a URL into a browser and press enter.`, testing: 'Networking fundamentals and systems thinking.', keyPoints: ['DNS resolution', 'TCP handshake', 'HTTP request/response'] },
    ],
    HR: [
      { category: 'HR', topic: 'Introduction', question: 'Tell me about yourself.', testing: 'Communication clarity and self-awareness.', keyPoints: ['relevant background', 'concise structure', 'connection to the role'] },
      { category: 'HR', topic: 'Strengths & weaknesses', question: 'What would you say is your biggest weakness, and how are you working on it?', testing: 'Self-awareness and growth mindset.', keyPoints: ['genuine weakness', 'concrete improvement steps', 'honesty'] },
      { category: 'HR', topic: 'Career goals', question: 'Where do you see yourself in the next few years?', testing: 'Alignment between the candidate and the role.', keyPoints: ['realistic goals', 'alignment with role', 'growth intent'] },
    ],
    BEHAVIORAL: [
      { category: 'BEHAVIORAL', topic: 'Teamwork', question: 'Tell me about a time you disagreed with a teammate. How did you resolve it?', testing: 'Conflict resolution and collaboration.', keyPoints: ['specific situation', 'action taken', 'outcome'] },
      { category: 'BEHAVIORAL', topic: 'Leadership', question: 'Describe a time you took initiative on a project without being asked.', testing: 'Ownership and initiative.', keyPoints: ['specific example', 'personal initiative', 'measurable outcome'] },
      { category: 'BEHAVIORAL', topic: 'Pressure', question: 'Tell me about a time you had to meet a tight deadline. What did you do?', testing: 'Time management under pressure.', keyPoints: ['prioritization', 'concrete actions', 'result'] },
    ],
    PROJECT: [
      { category: 'PROJECT', topic: subject, question: `Walk me through the most challenging project you've worked on related to ${subject}.`, testing: 'Depth of hands-on project experience.', keyPoints: ['problem statement', 'your specific contribution', 'measurable result'] },
      { category: 'PROJECT', topic: 'Trade-offs', question: 'Describe a technical decision you made on a project and what you would do differently now.', testing: 'Reflective engineering judgment.', keyPoints: ['decision rationale', 'trade-offs considered', 'hindsight/reflection'] },
    ],
  }
  const list = byCategory[category]
  return list.map((q) => ({ ...q, question: role !== 'Other' && role ? q.question : q.question, testing: difficulty === 'ADVANCED' ? `${q.testing} (advanced depth expected)` : q.testing }))
}

// ---------------------------------------------------------------------------
// Anthropic provider — only constructed when AI_PROVIDER=anthropic and a key is present.
// ---------------------------------------------------------------------------
class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic' as const
  constructor(private apiKey: string, private model: string) {}

  private async complete(system: string, userText: string): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: this.model, max_tokens: 1500, system, messages: [{ role: 'user', content: userText }] }),
    })
    if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`)
    const data = (await res.json()) as { content: { type: string; text?: string }[] }
    const textBlock = data.content.find((c) => c.type === 'text')
    if (!textBlock?.text) throw new Error('Anthropic API returned no text content')
    return textBlock.text
  }

  private async completeJson<T>(system: string, userText: string): Promise<T> {
    const text = await this.complete(`${system}\n\nRespond with ONLY valid JSON. No markdown fences, no preamble.`, userText)
    const cleaned = text.replace(/^```json\s*|```$/g, '').trim()
    return JSON.parse(cleaned) as T
  }

  async generateQuizQuestions(topic: string, subject: string, difficulty: string, count: number): Promise<GeneratedQuizQuestion[]> {
    return this.completeJson(
      'You are an exam question writer for a college study app. Generate rigorous, accurate quiz questions.',
      `Generate ${count} quiz questions about the topic "${topic}" (subject: "${subject}", difficulty: ${difficulty}). Mix MULTIPLE_CHOICE (4 options), TRUE_FALSE, and SHORT_ANSWER types. Return a JSON array of objects: {type, question, options (array or null), correctAnswer, explanation}.`,
    )
  }

  async generateInterviewQuestions(role: string, category: string, difficulty: string, count: number, context: { skills: string[]; subjects: string[] }): Promise<GeneratedInterviewQuestion[]> {
    return this.completeJson(
      'You are an experienced technical interviewer helping a student prepare.',
      `Generate ${count} ${category} interview questions for a "${role}" role at ${difficulty} difficulty. Candidate skills: ${context.skills.join(', ') || 'general'}. Candidate subjects: ${context.subjects.join(', ') || 'general CS'}. Return a JSON array of {category, topic, question, testing, keyPoints (array of short strings)}.`,
    )
  }

  async evaluateInterviewAnswer(question: string, keyPoints: string[], answer: string): Promise<AnswerEvaluation> {
    return this.completeJson(
      'You are a fair, constructive interview evaluator. Score strictly based on the answer given; never invent achievements the candidate did not mention.',
      `Question: ${question}\nExpected key points: ${keyPoints.join('; ')}\nCandidate answer: ${answer || '(no answer given)'}\n\nReturn JSON: {scores: {correctness, relevance, completeness, clarity, depth, communication} (each 0-100), overallScore (0-100), feedback (2-3 sentences, specific and constructive)}.`,
    )
  }

  async chat(system: string, history: ChatTurn[]): Promise<string> {
    const last = history[history.length - 1]
    const prior = history.slice(0, -1).map((h) => `${h.role}: ${h.content}`).join('\n')
    const lastContent = last?.content ?? ''
    return this.complete(system, `${prior ? `${prior}\n` : ''}user: ${lastContent}`)
  }
}

const mock = new MockProvider()

function buildProvider(): AiProvider {
  if (env.AI_PROVIDER === 'anthropic' && env.AI_API_KEY) return new AnthropicProvider(env.AI_API_KEY, env.AI_MODEL ?? 'claude-3-5-haiku-latest')
  // OpenAI and any misconfigured provider fall back to the deterministic mock rather than crash the app.
  return mock
}

const provider = buildProvider()

/** Wraps a provider call: on any failure (network, bad JSON, timeout) it falls back to the mock provider and reports that honestly via `source`. Never fabricates a successful AI response. */
async function withFallback<T>(real: () => Promise<T>, fallback: () => Promise<T>): Promise<AiResult<T>> {
  if (provider.name === 'mock') return { data: await fallback(), source: 'FALLBACK_BANK' }
  try {
    return { data: await real(), source: 'AI' }
  } catch (err) {
    console.error('[aiService] provider call failed, using fallback:', err instanceof Error ? err.message : err)
    return { data: await fallback(), source: 'FALLBACK_BANK' }
  }
}

export const aiService = {
  isMock: provider.name === 'mock',
  generateQuizQuestions: (topic: string, subject: string, difficulty: string, count: number) =>
    withFallback(() => provider.generateQuizQuestions(topic, subject, difficulty, count), () => mock.generateQuizQuestions(topic, subject, difficulty, count)),
  generateInterviewQuestions: (role: string, category: string, difficulty: string, count: number, context: { skills: string[]; subjects: string[] }) =>
    withFallback(() => provider.generateInterviewQuestions(role, category, difficulty, count, context), () => mock.generateInterviewQuestions(role, category, difficulty, count, context)),
  evaluateInterviewAnswer: (question: string, keyPoints: string[], answer: string) =>
    withFallback(() => provider.evaluateInterviewAnswer(question, keyPoints, answer), () => mock.evaluateInterviewAnswer(question, keyPoints, answer)),
  chat: (system: string, history: ChatTurn[]) => withFallback(() => provider.chat(system, history), () => mock.chat(system, history)),
}
