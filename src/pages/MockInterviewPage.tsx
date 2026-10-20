import { ArrowRight, CheckCircle2, Mic } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MOCK_INTERVIEW_TYPES, type MockInterviewType } from '@shared/interview'
import { TARGET_ROLES } from '@/features/onboarding/steps'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Alert, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { SelectField, TextAreaField } from '@/components/ui/Fields'
import { useToast } from '@/components/ui/Toast'
import { ApiError, errorMessage } from '@/lib/api'
import { useProfile } from '@/services/academics'
import { useAnswerMockQuestion, useCompleteMockInterview, useMockInterview, useStartMockInterview } from '@/services/interview'

const TYPE_LABEL: Record<MockInterviewType, string> = { TECHNICAL: 'Technical', HR: 'HR', MIXED: 'Mixed' }
const DIFFICULTIES = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const

function SetupForm() {
  const { data: profile } = useProfile()
  const navigate = useNavigate()
  const start = useStartMockInterview()
  const [role, setRole] = useState(profile?.targetRole ?? 'Software Developer')
  const [type, setType] = useState<MockInterviewType>('MIXED')
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>('INTERMEDIATE')
  const [questionCount, setQuestionCount] = useState('5')
  const [error, setError] = useState<string>()

  async function go() {
    setError(undefined)
    try {
      const res = await start.mutateAsync({ role, type, difficulty, questionCount: Number(questionCount) })
      navigate(`/mock-interview/${res.mockInterview.id}`, { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Could not start the mock interview.'))
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Mock Interview</h1>
        <p className="text-sm text-muted-foreground">Answer one question at a time and get a full readiness report at the end.</p>
      </div>
      <Card className="space-y-4 p-5 sm:p-6">
        {error && <Alert tone="error">{error}</Alert>}
        <SelectField label="Target role" value={role} onChange={(e) => setRole(e.target.value)}>
          {TARGET_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </SelectField>
        <SelectField label="Interview type" value={type} onChange={(e) => setType(e.target.value as MockInterviewType)}>
          {MOCK_INTERVIEW_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </SelectField>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>)}
          </SelectField>
          <SelectField label="Number of questions" value={questionCount} onChange={(e) => setQuestionCount(e.target.value)}>
            {[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
          </SelectField>
        </div>
        <Button className="w-full" size="lg" onClick={() => void go()} loading={start.isPending}><Mic className="size-4" aria-hidden="true" />Start interview</Button>
      </Card>
    </div>
  )
}

function InterviewFlow({ mockId }: { mockId: string }) {
  const { data: mock, isLoading, error, refetch } = useMockInterview(mockId)
  const answerMutation = useAnswerMockQuestion(mockId)
  const completeMutation = useCompleteMockInterview(mockId)
  const toast = useToast()
  const [answer, setAnswer] = useState('')
  const [error2, setError2] = useState<string>()

  if (isLoading) return <div className="mx-auto max-w-xl space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-48" /></div>
  if (error instanceof ApiError && error.status === 404) return <ErrorState message="This mock interview was not found." />
  if (error || !mock) return <ErrorState message="We could not load this mock interview." onRetry={() => void refetch()} />

  if (mock.status === 'COMPLETED' && mock.report) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Interview Report</h1>
          <p className="text-sm text-muted-foreground">{mock.role} · {TYPE_LABEL[mock.type]} · {mock.difficulty}</p>
        </div>
        <Card className="p-6 text-center">
          <p className="text-5xl font-semibold tabular-nums">{mock.report.overallScore}%</p>
          <p className="mt-1 text-sm text-muted-foreground">Overall interview performance</p>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5"><h2 className="font-semibold text-success">Strengths</h2><ul className="mt-2 list-inside list-disc text-sm">{mock.report.strengths.map((s) => <li key={s}>{s}</li>)}</ul></Card>
          <Card className="p-5"><h2 className="font-semibold text-destructive">Areas to improve</h2><ul className="mt-2 list-inside list-disc text-sm">{mock.report.weaknesses.map((s) => <li key={s}>{s}</li>)}</ul></Card>
        </div>
        <Card className="p-5">
          <h2 className="font-semibold">Suggested improvements</h2>
          <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">{mock.report.suggestedImprovements.map((s) => <li key={s}>{s}</li>)}</ul>
        </Card>
        <div className="flex justify-center gap-2">
          <Link to="/interview"><Button variant="secondary">Back to Interview Prep</Button></Link>
          <Link to="/mock-interview"><Button>New mock interview</Button></Link>
        </div>
      </div>
    )
  }

  const answeredIds = new Set(Object.keys(mock.answers))
  const nextQuestion = mock.questions.find((q) => !answeredIds.has(q.id))
  const allAnswered = !nextQuestion

  async function submitAnswer() {
    if (!nextQuestion) return
    setError2(undefined)
    try {
      await answerMutation.mutateAsync({ questionId: nextQuestion.id, answer })
      setAnswer('')
    } catch (err) {
      setError2(errorMessage(err, 'Could not evaluate your answer.'))
    }
  }
  async function finish() {
    try {
      await completeMutation.mutateAsync()
      toast.success('Interview complete.')
    } catch (err) {
      setError2(errorMessage(err, 'Could not complete the interview.'))
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{mock.role} Mock Interview</h1>
        <p className="text-sm text-muted-foreground">Question {answeredIds.size + (allAnswered ? 0 : 1)} of {mock.questionCount}</p>
      </div>
      {error2 && <Alert tone="error">{error2}</Alert>}
      {nextQuestion ? (
        <Card className="p-5 sm:p-6">
          <p className="text-xs font-medium text-muted-foreground">{nextQuestion.category} · {nextQuestion.topic}</p>
          <p className="mt-1.5 text-lg font-medium">{nextQuestion.question}</p>
          <TextAreaField label="Your answer" value={answer} onChange={(e) => setAnswer(e.target.value)} rows={6} className="mt-4" />
          <div className="mt-4 flex justify-end">
            <Button onClick={() => void submitAnswer()} loading={answerMutation.isPending} disabled={!answer.trim()}>Submit answer<ArrowRight className="size-4" aria-hidden="true" /></Button>
          </div>
        </Card>
      ) : (
        <Card className="p-6 text-center">
          <CheckCircle2 className="mx-auto size-8 text-success" aria-hidden="true" />
          <p className="mt-2 font-medium">All questions answered</p>
          <p className="text-sm text-muted-foreground">Finish the interview to get your full readiness report.</p>
          <Button className="mt-4" onClick={() => void finish()} loading={completeMutation.isPending}>Finish interview</Button>
        </Card>
      )}
      <ol className="flex flex-wrap gap-2">
        {mock.questions.map((q, i) => (
          <li key={q.id} className={`flex size-8 items-center justify-center rounded-full text-xs font-medium ${answeredIds.has(q.id) ? 'bg-success-soft text-success' : q.id === nextQuestion?.id ? 'bg-primary-soft text-primary-text' : 'bg-muted text-muted-foreground'}`}>{i + 1}</li>
        ))}
      </ol>
    </div>
  )
}

export default function MockInterviewPage() {
  const { id } = useParams()
  return id ? <InterviewFlow mockId={id} /> : <SetupForm />
}
