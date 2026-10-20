import { BarChart3 } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { ProgressBar } from '@/components/ui/Fields'
import { useSubjects } from '@/services/academics'
import { usePriorityTopics } from '@/services/priority'
import { useQuizHistory } from '@/services/quiz'
import { useReadiness, useReadinessTrend } from '@/services/readiness'

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  )
}

export default function AnalyticsPage() {
  const { data: subjects, isLoading: subjLoading, isError: subjError, refetch: refetchSubj } = useSubjects()
  const { data: quizzes } = useQuizHistory()
  const { data: readiness } = useReadiness()
  const { data: trend } = useReadinessTrend()
  const { data: priority } = usePriorityTopics()

  if (subjLoading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>
  if (subjError) return <ErrorState message="We could not load your analytics." onRetry={() => void refetchSubj()} />

  const totalTopics = subjects?.reduce((s, x) => s + x.topicCount, 0) ?? 0
  const completedTopics = subjects?.reduce((s, x) => s + x.completedCount, 0) ?? 0
  const submittedQuizzes = quizzes?.filter((q) => q.status === 'SUBMITTED') ?? []
  const avgQuizScore = submittedQuizzes.length > 0 ? Math.round(submittedQuizzes.reduce((s, q) => s + (q.score ?? 0), 0) / submittedQuizzes.length) : null
  const highPriorityCount = priority?.filter((p) => p.level === 'HIGH').length ?? 0

  if (totalTopics === 0) {
    return <EmptyState icon={<BarChart3 className="size-8" aria-hidden="true" />} title="Not enough data yet" description="Add subjects and topics, then come back to see your study analytics." />
  }

  const chartData = (trend ?? []).map((t) => ({ date: new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), Academic: t.academic, Interview: t.interview, Overall: t.overall }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Your preparation, measured from real activity — not guesses.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Topics completed" value={`${completedTopics}/${totalTopics}`} sub={`${Math.round((completedTopics / totalTopics) * 100)}% complete`} />
        <StatCard label="Average quiz score" value={avgQuizScore === null ? '—' : `${avgQuizScore}%`} sub={`${submittedQuizzes.length} quiz(zes) taken`} />
        <StatCard label="High-priority topics" value={String(highPriorityCount)} sub="Need attention soon" />
        <StatCard label="Overall readiness" value={readiness ? `${readiness.overall}%` : '—'} />
      </div>

      <Card className="p-5">
        <h2 className="font-semibold">Readiness trend</h2>
        {chartData.length < 2 ? (
          <p className="mt-4 text-sm text-muted-foreground">Keep studying and practicing — your readiness trend will appear here once it changes over a few sessions.</p>
        ) : (
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="date" fontSize={12} stroke="currentColor" className="text-muted-foreground" />
                <YAxis domain={[0, 100]} fontSize={12} stroke="currentColor" className="text-muted-foreground" />
                <Tooltip />
                <Line type="monotone" dataKey="Academic" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Interview" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Overall" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">Subject progress</h2>
        <ul className="mt-4 space-y-4">
          {subjects?.map((s) => (
            <li key={s.id}>
              <div className="flex justify-between text-sm"><span className="font-medium">{s.name}</span><span className="tabular-nums text-muted-foreground">{s.completionPercent}%</span></div>
              <ProgressBar value={s.completionPercent} label={`${s.name} completion`} className="mt-1.5" />
            </li>
          ))}
        </ul>
      </Card>

      {readiness && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-semibold">Academic readiness factors</h2>
            <ul className="mt-3 space-y-2 text-sm">{readiness.academicFactors.map((f) => <li key={f.label} className="flex justify-between"><span className="text-muted-foreground">{f.label}</span><span>{f.detail}</span></li>)}</ul>
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold">Interview readiness factors</h2>
            <ul className="mt-3 space-y-2 text-sm">{readiness.interviewFactors.map((f) => <li key={f.label} className="flex justify-between"><span className="text-muted-foreground">{f.label}</span><span>{f.detail}</span></li>)}</ul>
          </Card>
        </div>
      )}
    </div>
  )
}
