import { Brain, ChevronRight, Mic, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { INTERVIEW_CATEGORIES, type InterviewCategory } from '@shared/interview'
import { TARGET_ROLES } from '@/features/onboarding/steps'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Alert, EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { SelectField, TextAreaField } from '@/components/ui/Fields'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/api'
import { useProfile } from '@/services/academics'
import { useAnswerPracticeQuestion, useGenerateQuestions, useMockInterviews, usePracticeQuestions } from '@/services/interview'

const CATEGORY_LABEL: Record<InterviewCategory, string> = { TECHNICAL: 'Technical', HR: 'HR', BEHAVIORAL: 'Behavioral', PROJECT: 'Project' }
const DIFFICULTIES = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const

function QuestionCard({ question }: { question: ReturnType<typeof usePracticeQuestions>['data'] extends (infer T)[] | undefined ? T : never }) {
  const [answering, setAnswering] = useState(false)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<{ overallScore: number; feedback: string } | null>(null)
  const answerMutation = useAnswerPracticeQuestion()
  const toast = useToast()

  async function submit() {
    try {
      const res = await answerMutation.mutateAsync({ questionId: question.id, answer })
      setResult({ overallScore: res.answer.overallScore, feedback: res.answer.feedback })
    } catch (err) {
      toast.error(errorMessage(err, 'Could not evaluate your answer.'))
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-primary-soft px-2 py-0.5 font-medium text-primary-text">{CATEGORY_LABEL[question.category]}</span>
        <span className="text-muted-foreground">{question.difficulty} · {question.topic}</span>
      </div>
      <p className="mt-2 font-medium">{question.question}</p>
      <p className="mt-1.5 text-sm text-muted-foreground">What this tests: {question.testing}</p>
      {!answering && !result && <Button variant="secondary" size="sm" className="mt-3" onClick={() => setAnswering(true)}>Answer this</Button>}
      {answering && !result && (
        <div className="mt-3 space-y-2">
          <TextAreaField label="Your answer" value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAnswering(false)}>Cancel</Button>
            <Button size="sm" onClick={() => void submit()} loading={answerMutation.isPending} disabled={!answer.trim()}>Submit answer</Button>
          </div>
        </div>
      )}
      {result && (
        <div className="mt-3 rounded-lg bg-muted p-3 text-sm">
          <p className="font-medium">Score: {result.overallScore}/100</p>
          <p className="mt-1 text-muted-foreground">{result.feedback}</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-medium text-primary-text">Key points interviewers look for</summary>
            <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">{question.keyPoints.map((k) => <li key={k}>{k}</li>)}</ul>
          </details>
        </div>
      )}
    </Card>
  )
}

export default function InterviewPage() {
  const { data: profile } = useProfile()
  const [category, setCategory] = useState<InterviewCategory>('TECHNICAL')
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>('INTERMEDIATE')
  const [role, setRole] = useState(profile?.targetRole ?? 'Software Developer')
  const { data: questions, isLoading, isError, refetch } = usePracticeQuestions(category, difficulty)
  const generate = useGenerateQuestions()
  const { data: mocks } = useMockInterviews()
  const toast = useToast()
  const [genError, setGenError] = useState<string>()

  async function onGenerate() {
    setGenError(undefined)
    try {
      await generate.mutateAsync({ role: role || 'Software Developer', category, difficulty, count: 5 })
      toast.success('New questions generated.')
    } catch (err) {
      setGenError(errorMessage(err, 'Could not generate new questions.'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Interview Preparation</h1>
          <p className="text-sm text-muted-foreground">Practice technical, HR, behavioral, and project questions for your target role.</p>
        </div>
        <Link to="/mock-interview" className="shrink-0"><Button><Mic className="size-4" aria-hidden="true" />Start mock interview</Button></Link>
      </div>

      {mocks && mocks.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-medium">Recent mock interviews</p>
          <ul className="mt-2 space-y-1.5">
            {mocks.slice(0, 3).map((m) => (
              <li key={m.id}>
                <Link to={`/mock-interview/${m.id}`} className="flex items-center justify-between text-sm hover:underline">
                  <span>{m.role} · {m.type}</span>
                  <span className="flex items-center gap-1 text-muted-foreground">{m.status === 'COMPLETED' ? `${m.overallScore}%` : 'In progress'}<ChevronRight className="size-4" aria-hidden="true" /></span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Target role" value={role} onChange={(e) => setRole(e.target.value)}>
            {TARGET_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </SelectField>
          <SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value as InterviewCategory)}>
            {INTERVIEW_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </SelectField>
          <SelectField label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>)}
          </SelectField>
        </div>
        {genError && <Alert tone="error">{genError}</Alert>}
        <Button onClick={() => void onGenerate()} loading={generate.isPending}><Sparkles className="size-4" aria-hidden="true" />Generate new questions</Button>
      </Card>

      {isLoading && <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>}
      {isError && <ErrorState message="We could not load practice questions." onRetry={() => void refetch()} />}
      {questions && questions.length === 0 && <EmptyState icon={<Brain className="size-8" aria-hidden="true" />} title="No questions yet" description="Generate questions for this category and difficulty to start practicing." />}
      {questions && questions.length > 0 && <div className="space-y-4">{questions.map((q) => <QuestionCard key={q.id} question={q} />)}</div>}
    </div>
  )
}
