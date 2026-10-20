import { CalendarDays, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/api'
import { useActivePlan, useCompleteTask, type StudyTaskDto } from '@/services/plan'

const TYPE_TONE: Record<StudyTaskDto['type'], string> = {
  LEARN: 'bg-primary-soft text-primary-text', PRACTICE: 'bg-sky-100 text-sky-700', QUIZ: 'bg-amber-100 text-amber-700',
  REVISION: 'bg-warning-soft text-warning', INTERVIEW: 'bg-violet-100 text-violet-700',
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d)
  const day = copy.getDay() === 0 ? 7 : copy.getDay()
  copy.setDate(copy.getDate() - (day - 1))
  copy.setHours(0, 0, 0, 0)
  return copy
}
function toIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default function CalendarPage() {
  const { data: plan, isLoading, isError, refetch } = useActivePlan()
  const complete = useCompleteTask()
  const toast = useToast()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d }), [weekStart])
  const tasksByDate = useMemo(() => {
    const map = new Map<string, StudyTaskDto[]>()
    for (const t of plan?.tasks ?? []) map.set(t.date, [...(map.get(t.date) ?? []), t].sort((a, b) => a.startMinute - b.startMinute))
    return map
  }, [plan])

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-96" /></div>
  if (isError) return <ErrorState message="We could not load your calendar." onRetry={() => void refetch()} />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">Your study sessions, revision, and interview practice for the week.</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Previous week" onClick={() => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() - 7); return d })}><ChevronLeft className="size-4" aria-hidden="true" /></Button>
          <Button variant="secondary" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>This week</Button>
          <Button variant="ghost" size="icon" aria-label="Next week" onClick={() => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() + 7); return d })}><ChevronRight className="size-4" aria-hidden="true" /></Button>
        </div>
      </div>

      {!plan || plan.tasks.length === 0 ? (
        <EmptyState icon={<CalendarDays className="size-8" aria-hidden="true" />} title="Nothing scheduled" description="Generate a study plan to see your sessions here." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {days.map((d) => {
            const iso = toIso(d)
            const dayTasks = tasksByDate.get(iso) ?? []
            const isToday = iso === toIso(new Date())
            return (
              <Card key={iso} className={`min-h-[8rem] p-3 ${isToday ? 'ring-2 ring-primary' : ''}`}>
                <p className="text-xs font-semibold text-muted-foreground">{d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</p>
                <ul className="mt-2 space-y-1.5">
                  {dayTasks.map((t) => (
                    <li key={t.id} className={`rounded-lg px-2 py-1.5 text-xs ${TYPE_TONE[t.type]} ${t.status !== 'PENDING' ? 'opacity-50' : ''}`}>
                      <div className="flex items-start justify-between gap-1">
                        <span className="truncate font-medium">{t.topicName ?? t.subjectName ?? t.type}</span>
                        {t.status === 'PENDING' && (
                          <button aria-label="Mark complete" onClick={() => complete.mutate(t.id, { onError: (e) => toast.error(errorMessage(e)) })} className="shrink-0"><Check className="size-3.5" aria-hidden="true" /></button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
