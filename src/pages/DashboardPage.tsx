import { BookOpen, CalendarRange, ClipboardCheck, Flame, Mic, Sparkles, Target } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, Skeleton } from '@/components/ui/Feedback'
import { ProgressBar } from '@/components/ui/Fields'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'
import { STATUS_LABEL } from '@/features/academics/ui'
import { firstName, greetingForHour } from '@/lib/greeting'
import { useProfile, useSubjects } from '@/services/academics'
import { useMockInterviews } from '@/services/interview'
import { usePriorityTopics } from '@/services/priority'
import { useActivePlan } from '@/services/plan'
import { useQuizHistory } from '@/services/quiz'
import { useReadiness } from '@/services/readiness'
import { useTodayStats } from '@/services/stats'

const PRIORITY_TONE: Record<'HIGH' | 'MEDIUM' | 'LOW', string> = { HIGH: 'bg-destructive-soft text-destructive', MEDIUM: 'bg-warning-soft text-warning', LOW: 'bg-muted text-muted-foreground' }

function ReadinessRing({ label, value }: { label: string; value: number }) {
  const circumference = 2 * Math.PI * 34
  const offset = circumference * (1 - value / 100)
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
        <circle cx="44" cy="44" r="34" fill="none" strokeWidth="8" className="stroke-muted" />
        <circle cx="44" cy="44" r="34" fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="stroke-primary transition-[stroke-dashoffset]" />
      </svg>
      <p className="-mt-14 text-xl font-semibold tabular-nums">{value}%</p>
      <p className="mt-8 text-center text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  )
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: typeof BookOpen; label: string }) {
  return (
    <Link to={to} className={cn(buttonVariants({ variant: 'secondary' }), 'h-auto flex-col gap-1.5 py-3')}>
      <Icon className="size-5" aria-hidden="true" />
      <span className="text-xs">{label}</span>
    </Link>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { data: subjects, isLoading: subjectsLoading } = useSubjects()
  const { data: priority, isLoading: priorityLoading } = usePriorityTopics()
  const { data: plan, isLoading: planLoading } = useActivePlan()
  const { data: quizzes } = useQuizHistory()
  const { data: mocks } = useMockInterviews()
  const { data: readiness, isLoading: readinessLoading } = useReadiness()
  const { data: profile } = useProfile()
  const { data: todayStats } = useTodayStats()

  const name = firstName(user?.name ?? '')
  const greeting = greetingForHour(new Date().getHours())
  const hasAnySubjects = (subjects?.length ?? 0) > 0

  const todayIso = new Date().toISOString().slice(0, 10)
  const todaysTasks = plan?.tasks.filter((t) => t.date === todayIso) ?? []
  const topPriority = (priority ?? []).slice(0, 5)
  const recentQuizzes = (quizzes ?? []).filter((q) => q.status === 'SUBMITTED').slice(0, 3)
  const completedMocks = (mocks ?? []).filter((m) => m.status === 'COMPLETED')

  const totalTopics = subjects?.reduce((s, x) => s + x.topicCount, 0) ?? 0
  const completedTopics = subjects?.reduce((s, x) => s + x.completedCount, 0) ?? 0
  const revisionTopics = (priority ?? []).filter((p) => p.status === 'NEEDS_REVISION').length

  const daysUntil = (dateStr: string | null | undefined): number | null => {
    if (!dateStr) return null
    const diff = Math.round((new Date(`${dateStr}T00:00:00`).getTime() - new Date(`${todayIso}T00:00:00`).getTime()) / 86_400_000)
    return diff >= 0 ? diff : null
  }
  const examDays = daysUntil(profile?.examDate)
  const interviewDays = daysUntil(profile?.interviewDate)
  const todayHours = todayStats ? Math.round((todayStats.todayMinutes / 60) * 10) / 10 : 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{greeting}, {name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here's where your preparation stands today.</p>
      </div>

      <Card className="p-5 sm:p-6">
        {readinessLoading ? <Skeleton className="h-24" /> : readiness && (
          <div className="grid grid-cols-3 gap-4">
            <ReadinessRing label="Academic Readiness" value={readiness.academic} />
            <ReadinessRing label="Interview Readiness" value={readiness.interview} />
            <ReadinessRing label="Overall Preparation" value={readiness.overall} />
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Topics completed</p><p className="mt-1 text-xl font-semibold tabular-nums">{completedTopics}/{totalTopics}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Needs revision</p><p className="mt-1 text-xl font-semibold tabular-nums">{revisionTopics}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Today's tasks</p><p className="mt-1 text-xl font-semibold tabular-nums">{todaysTasks.filter((t) => t.status === 'COMPLETED').length}/{todaysTasks.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Mock interviews</p><p className="mt-1 flex items-center gap-1 text-xl font-semibold tabular-nums">{completedMocks.length}</p></Card>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Today's study hours</p><p className="mt-1 text-xl font-semibold tabular-nums">{todayHours}h</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Study streak</p><p className="mt-1 flex items-center gap-1 text-xl font-semibold tabular-nums"><Flame className="size-4 text-warning" aria-hidden="true" />{todayStats?.streakDays ?? 0}d</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Upcoming exam</p><p className="mt-1 text-xl font-semibold tabular-nums">{examDays === null ? '—' : `${examDays}d`}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Upcoming interview</p><p className="mt-1 text-xl font-semibold tabular-nums">{interviewDays === null ? '—' : `${interviewDays}d`}</p></Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <QuickAction to="/subjects" icon={BookOpen} label="Add Subject" />
          <QuickAction to="/planner" icon={CalendarRange} label="Generate Plan" />
          <QuickAction to="/quizzes" icon={ClipboardCheck} label="Take Quiz" />
          <QuickAction to="/interview" icon={Target} label="Practice Interview" />
          <QuickAction to="/mock-interview" icon={Mic} label="Mock Interview" />
          <QuickAction to="/revision" icon={Sparkles} label="Revision" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Today's Plan</h2>
            <Link to="/planner" className="text-xs font-medium text-primary-text hover:underline">View planner</Link>
          </div>
          {planLoading ? <Skeleton className="h-32" /> : todaysTasks.length === 0 ? (
            <EmptyState title="No study plan" description="Generate your personalized study plan." action={<Link to="/planner" className={cn(buttonVariants({ size: 'sm' }))}>Generate Plan</Link>} />
          ) : (
            <ul className="space-y-2">
              {todaysTasks.slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span className={t.status === 'COMPLETED' ? 'text-muted-foreground line-through' : ''}>{t.topicName ?? t.subjectName ?? t.type}</span>
                  <span className="text-xs text-muted-foreground">{t.durationMinutes} min</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Priority Topics</h2>
            <Target className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
          {priorityLoading ? <Skeleton className="h-32" /> : !hasAnySubjects ? (
            <EmptyState title="No subjects yet" description="Add your first subject to start your preparation." action={<Link to="/subjects" className={cn(buttonVariants({ size: 'sm' }))}>Add Subject</Link>} />
          ) : topPriority.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing urgent right now — nice work!</p>
          ) : (
            <ul className="space-y-2.5">
              {topPriority.map((p) => (
                <li key={p.topicId} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.topicName}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.reasons[0] ?? STATUS_LABEL[p.status as keyof typeof STATUS_LABEL]} · ~{p.recommendedMinutes} min</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_TONE[p.level]}`}>{p.level}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Recent Performance</h2>
            <Link to="/quizzes" className="text-xs font-medium text-primary-text hover:underline">View all</Link>
          </div>
          {recentQuizzes.length === 0 ? (
            <EmptyState title="No quiz history yet" description="Complete your first quiz to see your performance." action={<Link to="/quizzes" className={cn(buttonVariants({ size: 'sm' }))}>Take Quiz</Link>} />
          ) : (
            <ul className="space-y-2">
              {recentQuizzes.map((q) => (
                <li key={q.id} className="flex items-center justify-between text-sm">
                  <Link to={`/quizzes/${q.id}`} className="truncate hover:underline">{q.title}</Link>
                  <span className="font-semibold tabular-nums">{q.score}%</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Interview Preparation</h2>
            <Link to="/interview" className="text-xs font-medium text-primary-text hover:underline">Practice</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-muted-foreground">Mock interviews</p><p className="text-lg font-semibold tabular-nums">{completedMocks.length}</p></div>
            <div><p className="text-muted-foreground">Interview readiness</p><p className="text-lg font-semibold tabular-nums">{readiness?.interview ?? 0}%</p></div>
          </div>
          <ProgressBar value={readiness?.interview ?? 0} label="Interview readiness" className="mt-3" />
        </Card>
      </div>

      {!subjectsLoading && !hasAnySubjects && (
        <EmptyState icon={<BookOpen className="size-8" aria-hidden="true" />} title="Let's get started" description="Add your first subject to unlock priority topics, study plans, quizzes, and readiness tracking." action={<Link to="/subjects" className={cn(buttonVariants())}>Add your first subject</Link>} />
      )}
    </div>
  )
}
