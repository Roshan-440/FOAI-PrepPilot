import { CheckCircle2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { QuizAttemptDto, QuizResultDto } from '@shared/quiz'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Alert, EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import { ApiError, errorMessage } from '@/lib/api'
import { useQuizAttempt, useSubmitQuiz } from '@/services/quiz'

function isResult(quiz: QuizAttemptDto | QuizResultDto): quiz is QuizResultDto {
  return quiz.status === 'SUBMITTED'
}

function InProgressQuiz({ quiz }: { quiz: QuizAttemptDto }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [error, setError] = useState<string>()
  const submit = useSubmitQuiz(quiz.id)
  const toast = useToast()
  const answeredCount = Object.values(answers).filter((a) => a.trim().length > 0).length

  async function onSubmit() {
    setError(undefined)
    try {
      await submit.mutateAsync(quiz.questions.map((q) => ({ questionId: q.id, answer: answers[q.id] ?? '' })))
      toast.success('Quiz submitted.')
    } catch (err) {
      setError(errorMessage(err, 'Could not submit your quiz.'))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{quiz.title}</h1>
        <p className="text-sm text-muted-foreground">{answeredCount} of {quiz.questions.length} answered</p>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <ol className="space-y-5">
        {quiz.questions.map((q, i) => (
          <li key={q.id}>
            <Card className="p-5">
              <p className="text-xs font-medium text-muted-foreground">Question {i + 1} · {q.topicName}</p>
              <p className="mt-1.5 font-medium">{q.question}</p>
              {q.options ? (
                <div className="mt-3 space-y-2">
                  {q.options.map((opt) => (
                    <label key={opt} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-input px-3 py-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                      <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt} onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))} className="accent-current" />
                      {opt}
                    </label>
                  ))}
                </div>
              ) : (
                <textarea rows={3} value={answers[q.id] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} placeholder="Type your answer..." className="mt-3 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm" />
              )}
            </Card>
          </li>
        ))}
      </ol>
      <div className="flex justify-end">
        <Button size="lg" onClick={() => void onSubmit()} loading={submit.isPending}>Submit quiz</Button>
      </div>
    </div>
  )
}

function ResultQuiz({ quiz }: { quiz: QuizResultDto }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{quiz.title}</h1>
        <p className="text-sm text-muted-foreground">Submitted {new Date(quiz.submittedAt ?? '').toLocaleString()}</p>
      </div>
      <Card className="flex flex-wrap items-center gap-6 p-6">
        <div>
          <p className="text-4xl font-semibold tabular-nums">{quiz.score}%</p>
          <p className="text-sm text-muted-foreground">{quiz.correctCount} of {quiz.totalCount} correct</p>
        </div>
        <div className="min-w-[16rem] flex-1">
          <p className="text-sm font-medium">Recommended next steps</p>
          <ul className="mt-1.5 list-inside list-disc text-sm text-muted-foreground">
            {quiz.recommendedActions.map((a) => <li key={a}>{a}</li>)}
          </ul>
        </div>
      </Card>

      {quiz.weakTopics.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold">Weak topics from this quiz</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {quiz.weakTopics.map((t) => (
              <li key={t.topicId} className="flex justify-between">
                <Link to={`/subjects`} className="text-primary-text hover:underline">{t.topicName}</Link>
                <span className="text-muted-foreground">{t.correctCount}/{t.totalCount} correct</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ol className="space-y-4">
        {quiz.questions.map((q, i) => (
          <li key={q.id}>
            <Card className={`p-5 border-l-4 ${q.isCorrect ? 'border-l-success' : 'border-l-destructive'}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium text-muted-foreground">Question {i + 1} · {q.topicName}</p>
                {q.isCorrect ? <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" /> : <XCircle className="size-5 shrink-0 text-destructive" aria-hidden="true" />}
              </div>
              <p className="mt-1.5 font-medium">{q.question}</p>
              <p className="mt-2 text-sm"><span className="text-muted-foreground">Your answer: </span>{q.userAnswer || <em className="text-muted-foreground">No answer</em>}</p>
              {!q.isCorrect && <p className="text-sm"><span className="text-muted-foreground">Correct answer: </span>{q.correctAnswer}</p>}
              <p className="mt-2 text-sm text-muted-foreground">{q.explanation}</p>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function QuizTakePage() {
  const { id = '' } = useParams()
  const { data: quiz, isLoading, error, refetch } = useQuizAttempt(id)

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
  if (error instanceof ApiError && error.status === 404) {
    return <EmptyState title="Quiz not found" description="It may not exist or may belong to another account." action={<Link to="/quizzes" className="text-sm font-medium text-primary-text hover:underline">Back to quizzes</Link>} />
  }
  if (error || !quiz) return <ErrorState message="We could not load this quiz." onRetry={() => void refetch()} />

  return isResult(quiz) ? <ResultQuiz quiz={quiz} /> : <InProgressQuiz quiz={quiz} />
}
