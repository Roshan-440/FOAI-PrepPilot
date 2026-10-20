import { CalendarRange, Check, SkipForward, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { WEEKDAYS } from '@/features/onboarding/steps'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Alert, EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import { useProfile, useSubjects } from '@/services/academics'
import { errorMessage } from '@/lib/api'
import { useActivePlan, useCompleteTask, useGeneratePlan, useSkipTask, type StudyTaskDto } from '@/services/plan'

const TYPE_LABEL: Record<StudyTaskDto['type'], string> = { LEARN: 'Learn', PRACTICE: 'Practice', QUIZ: 'Quiz', REVISION: 'Revision', INTERVIEW: 'Interview' }
const PRIORITY_TONE: Record<StudyTaskDto['priority'], string> = { HIGH: 'bg-destructive-soft text-destructive', MEDIUM: 'bg-warning-soft text-warning', LOW: 'bg-muted text-muted-foreground' }

function formatTime(startMinute: number): string {
  const h = Math.floor(startMinute / 60)
  const m = startMinute % 60
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`
}

function GenerateForm({ onGenerated }: { onGenerated: () => void }) {
  const { data: profile } = useProfile()
  const { data: subjects } = useSubjects()
  const generate = useGeneratePlan()
  const toast = useToast()
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(() => {
    const today = new Date().toISOString().slice(0, 10)
    const inTwoWeeks = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
    return profile?.examDate && profile.examDate > today ? profile.examDate : inTwoWeeks
  })
  const [hoursPerDay, setHoursPerDay] = useState(String(profile?.availableHoursPerDay ?? 2))
  const [studyDays, setStudyDays] = useState<number[]>(profile?.preferredStudyDays?.length ? profile.preferredStudyDays : [1, 2, 3, 4, 5])
  const [subjectIds, setSubjectIds] = useState<string[]>([])
  const [error, setError] = useState<string>()

  async function go() {
    setError(undefined)
    try {
      const res = await generate.mutateAsync({ startDate, endDate, hoursPerDay: Number(hoursPerDay), studyDays, subjectIds: subjectIds.length > 0 ? subjectIds : undefined })
      if (res.plan.warnings.length > 0) toast.error(res.plan.warnings[0] ?? 'Some items could not fit in your plan.')
      else toast.success('Study plan generated.')
      onGenerated()
    } catch (err) {
      setError(errorMessage(err, 'Could not generate a study plan.'))
    }
  }

  return (
    <Card className="space-y-5 p-5 sm:p-6">
      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">Start date
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-input bg-card px-3 text-base sm:text-sm" />
        </label>
        <label className="block text-sm font-medium">End date
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-input bg-card px-3 text-base sm:text-sm" />
        </label>
      </div>
      <label className="block text-sm font-medium">Available hours per day
        <input type="number" min={0.5} max={16} step={0.5} value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-input bg-card px-3 text-base sm:text-sm" />
      </label>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Study days</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => {
            const active = studyDays.includes(d.value)
            return (
              <button key={d.value} type="button" aria-pressed={active} onClick={() => setStudyDays(active ? studyDays.filter((v) => v !== d.value) : [...studyDays, d.value].sort())}
                className={`h-9 rounded-lg border px-3 text-sm font-medium ${active ? 'border-primary bg-primary-soft text-primary-text' : 'border-input text-muted-foreground'}`}>
                {d.label}
              </button>
            )
          })}
        </div>
      </fieldset>
      {subjects && subjects.length > 0 && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Subjects <span className="font-normal text-muted-foreground">(optional — leave blank for all)</span></legend>
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => {
              const active = subjectIds.includes(s.id)
              return (
                <button key={s.id} type="button" aria-pressed={active} onClick={() => setSubjectIds(active ? subjectIds.filter((v) => v !== s.id) : [...subjectIds, s.id])}
                  className={`h-9 rounded-lg border px-3 text-sm font-medium ${active ? 'border-primary bg-primary-soft text-primary-text' : 'border-input text-muted-foreground'}`}>
                  {s.name}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}
      <Button onClick={() => void go()} loading={generate.isPending} disabled={studyDays.length === 0}><Sparkles className="size-4" aria-hidden="true" />Generate plan</Button>
    </Card>
  )
}

function TaskRow({ task }: { task: StudyTaskDto }) {
  const complete = useCompleteTask()
  const skip = useSkipTask()
  const toast = useToast()
  const isDone = task.status !== 'PENDING'
  return (
    <li className={`flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 ${isDone ? 'opacity-60' : ''}`}>
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{formatTime(task.startMinute)}</span>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${task.status === 'COMPLETED' ? 'line-through' : ''}`}>{task.topicName ?? task.subjectName ?? TYPE_LABEL[task.type]}</p>
        <p className="truncate text-xs text-muted-foreground">{TYPE_LABEL[task.type]} · {task.durationMinutes} min{task.subjectName && task.topicName ? ` · ${task.subjectName}` : ''}</p>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_TONE[task.priority]}`}>{task.priority}</span>
      {task.status === 'PENDING' && (
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" aria-label="Mark complete" disabled={complete.isPending} onClick={() => complete.mutate(task.id, { onSuccess: () => toast.success('Task completed.'), onError: (e) => toast.error(errorMessage(e)) })}><Check className="size-4" aria-hidden="true" /></Button>
          <Button variant="ghost" size="icon" aria-label="Skip task" disabled={skip.isPending} onClick={() => skip.mutate(task.id, { onError: (e) => toast.error(errorMessage(e)) })}><SkipForward className="size-4" aria-hidden="true" /></Button>
        </div>
      )}
      {task.status !== 'PENDING' && <span className="shrink-0 text-xs text-muted-foreground">{task.status === 'COMPLETED' ? 'Done' : task.status === 'MISSED' ? 'Missed' : 'Skipped'}</span>}
    </li>
  )
}

export default function PlannerPage() {
  const { data: plan, isLoading, isError, refetch } = useActivePlan()
  const [regenerating, setRegenerating] = useState(false)

  const byDate = useMemo(() => {
    const map = new Map<string, StudyTaskDto[]>()
    for (const t of plan?.tasks ?? []) map.set(t.date, [...(map.get(t.date) ?? []), t])
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [plan])

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>
  if (isError) return <ErrorState message="We could not load your study plan." onRetry={() => void refetch()} />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Study Planner</h1>
          <p className="text-sm text-muted-foreground">A schedule built from your topic priorities — never overloaded, always explained.</p>
        </div>
        {plan && !regenerating && <Button variant="secondary" onClick={() => setRegenerating(true)}>Generate new plan</Button>}
      </div>

      {(!plan || regenerating) && <GenerateForm onGenerated={() => setRegenerating(false)} />}

      {plan && !regenerating && (
        <>
          {plan.warnings.length > 0 && plan.warnings.map((w) => <Alert key={w} tone="warning">{w}</Alert>)}
          <p className="text-sm text-muted-foreground">{plan.startDate} to {plan.endDate} · {plan.hoursPerDay}h/day</p>
          {byDate.length === 0 ? (
            <EmptyState icon={<CalendarRange className="size-8" aria-hidden="true" />} title="No tasks scheduled" description="Generate your personalized study plan to see tasks here." />
          ) : (
            <div className="space-y-6">
              {byDate.map(([date, tasks]) => (
                <div key={date}>
                  <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h2>
                  <ul className="space-y-2">{tasks.map((t) => <TaskRow key={t.id} task={t} />)}</ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
