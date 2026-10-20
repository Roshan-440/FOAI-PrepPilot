import { BookOpen, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { ProgressBar } from '@/components/ui/Fields'
import { useToast } from '@/components/ui/Toast'
import { SubjectFormModal } from '@/features/academics/SubjectFormModal'
import { dotClass } from '@/features/academics/ui'
import { useCreateSubject, useSubjects } from '@/services/academics'

export default function SubjectsPage() {
  const { data, isLoading, isError, refetch } = useSubjects()
  const create = useCreateSubject()
  const toast = useToast()
  const [adding, setAdding] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Subjects</h1>
          <p className="text-sm text-muted-foreground">Everything you are preparing for, with progress at a glance.</p>
        </div>
        <Button onClick={() => setAdding(true)}><Plus className="size-4" aria-hidden="true" />Add subject</Button>
      </div>

      {isLoading && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}</div>}
      {isError && <ErrorState message="We could not load your subjects." onRetry={() => void refetch()} />}
      {data && data.length === 0 && (
        <EmptyState icon={<BookOpen className="size-8" aria-hidden="true" />} title="No subjects yet" description="Add your first subject to start your preparation." action={<Button onClick={() => setAdding(true)}>Add subject</Button>} />
      )}
      {data && data.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((s) => (
            <li key={s.id}>
              <Link to={`/subjects/${s.id}`} className="block rounded-xl">
                <Card className="h-full p-5 transition-colors hover:border-primary/50">
                  <div className="flex items-center gap-2.5">
                    <span className={`size-3 shrink-0 rounded-full ${dotClass(s.color)}`} aria-hidden="true" />
                    <h2 className="min-w-0 truncate font-semibold">{s.name}</h2>
                  </div>
                  {s.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>}
                  <div className="mt-4 flex items-baseline justify-between text-sm">
                    <span className="text-muted-foreground">{s.topicCount === 0 ? 'No topics yet' : `${s.completedCount} of ${s.topicCount} topics done`}</span>
                    <span className="font-semibold tabular-nums">{s.completionPercent}%</span>
                  </div>
                  <ProgressBar value={s.completionPercent} label={`${s.name} completion`} className="mt-2" />
                  {s.examDate && <p className="mt-3 text-xs text-muted-foreground">Exam: {new Date(`${s.examDate}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <SubjectFormModal open={adding} onClose={() => setAdding(false)} onSubmit={async (values) => { await create.mutateAsync(values); toast.success('Subject added.') }} />
    </div>
  )
}
