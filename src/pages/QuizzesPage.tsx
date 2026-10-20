import { ClipboardList, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { QuizSourceType } from '@shared/quiz'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Alert, EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Modal, SelectField } from '@/components/ui/Fields'
import { errorMessage } from '@/lib/api'
import { useSubjectDetail, useSubjects } from '@/services/academics'
import { useQuizHistory, useStartQuiz } from '@/services/quiz'

const SOURCE_LABEL: Record<QuizSourceType, string> = { TOPIC: 'A specific topic', SUBJECT: 'A whole subject', WEAK: 'My weak topics', MIXED: 'Mixed review' }

function StartQuizModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: subjects } = useSubjects()
  const navigate = useNavigate()
  const start = useStartQuiz()
  const [sourceType, setSourceType] = useState<QuizSourceType>('MIXED')
  const [subjectId, setSubjectId] = useState('')
  const [topicId, setTopicId] = useState('')
  const [count, setCount] = useState('8')
  const [error, setError] = useState<string>()
  const selectedSubject = subjects?.find((s) => s.id === subjectId)

  async function go() {
    setError(undefined)
    try {
      const quiz = await start.mutateAsync({ sourceType, subjectId: sourceType === 'SUBJECT' ? subjectId : undefined, topicId: sourceType === 'TOPIC' ? topicId : undefined, count: Number(count) })
      onClose()
      navigate(`/quizzes/${quiz.quiz.id}`)
    } catch (err) {
      setError(errorMessage(err, 'Could not start this quiz.'))
    }
  }

  return (
    <Modal open={open} title="Start a quiz" onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <SelectField label="Quiz source" value={sourceType} onChange={(e) => setSourceType(e.target.value as QuizSourceType)}>
          {(Object.keys(SOURCE_LABEL) as QuizSourceType[]).map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
        </SelectField>
        {sourceType === 'SUBJECT' && (
          <SelectField label="Subject" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId('') }}>
            <option value="">Choose a subject</option>
            {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectField>
        )}
        {sourceType === 'TOPIC' && (
          <>
            <SelectField label="Subject" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId('') }}>
              <option value="">Choose a subject</option>
              {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </SelectField>
            {subjectId && <TopicPicker subjectId={subjectId} topicId={topicId} onChange={setTopicId} />}
          </>
        )}
        <SelectField label="Number of questions" value={count} onChange={(e) => setCount(e.target.value)}>
          {[5, 8, 10, 15].map((n) => <option key={n} value={n}>{n}</option>)}
        </SelectField>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={start.isPending}>Cancel</Button>
          <Button onClick={() => void go()} loading={start.isPending} disabled={(sourceType === 'SUBJECT' && !subjectId) || (sourceType === 'TOPIC' && !topicId)}>
            <Sparkles className="size-4" aria-hidden="true" />Start quiz
          </Button>
        </div>
      </div>
      {selectedSubject && selectedSubject.topicCount === 0 && sourceType !== 'MIXED' && sourceType !== 'WEAK' && (
        <p className="mt-2 text-xs text-destructive">This subject has no topics yet.</p>
      )}
    </Modal>
  )
}

function TopicPicker({ subjectId, topicId, onChange }: { subjectId: string; topicId: string; onChange: (id: string) => void }) {
  const { data } = useSubjects()
  const subject = data?.find((s) => s.id === subjectId)
  return (
    <SelectField label="Topic" value={topicId} onChange={(e) => onChange(e.target.value)} hint={subject && subject.topicCount === 0 ? 'This subject has no topics yet.' : undefined}>
      <option value="">Choose a topic</option>
      <TopicOptions subjectId={subjectId} />
    </SelectField>
  )
}
function TopicOptions({ subjectId }: { subjectId: string }) {
  // Reuses the subject-detail query so no extra network call is needed if the page was already visited.
  const { data } = useSubjectDetail(subjectId)
  return <>{data?.topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</>
}

function scoreTone(score: number | null): string {
  if (score === null) return 'bg-muted text-muted-foreground'
  if (score >= 80) return 'bg-success-soft text-success'
  if (score >= 50) return 'bg-warning-soft text-warning'
  return 'bg-destructive-soft text-destructive'
}

export default function QuizzesPage() {
  const { data, isLoading, isError, refetch } = useQuizHistory()
  const [starting, setStarting] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quizzes</h1>
          <p className="text-sm text-muted-foreground">Test yourself on a topic, a subject, your weak spots, or a mixed review.</p>
        </div>
        <Button onClick={() => setStarting(true)}><Sparkles className="size-4" aria-hidden="true" />Start a quiz</Button>
      </div>

      {isLoading && <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>}
      {isError && <ErrorState message="We could not load your quiz history." onRetry={() => void refetch()} />}
      {data && data.length === 0 && (
        <EmptyState icon={<ClipboardList className="size-8" aria-hidden="true" />} title="No quiz history yet" description="Complete your first quiz to see your performance." action={<Button onClick={() => setStarting(true)}>Start a quiz</Button>} />
      )}
      {data && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((q) => (
            <li key={q.id}>
              <Link to={`/quizzes/${q.id}`} className="block">
                <Card className="flex items-center justify-between gap-4 p-4 transition-colors hover:border-primary/50">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{q.title}</p>
                    <p className="text-xs text-muted-foreground">{q.status === 'IN_PROGRESS' ? 'In progress' : new Date(q.submittedAt ?? q.startedAt).toLocaleDateString()} · {q.totalCount} questions</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${scoreTone(q.score)}`}>{q.score === null ? 'In progress' : `${q.score}%`}</span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <StartQuizModal open={starting} onClose={() => setStarting(false)} />
    </div>
  )
}
