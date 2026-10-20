import { RefreshCw, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/api'
import { useDismissRevision, useRevisions } from '@/services/revision'

export default function RevisionPage() {
  const { data, isLoading, isError, refetch } = useRevisions()
  const dismiss = useDismissRevision()
  const toast = useToast()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Revision</h1>
        <p className="text-sm text-muted-foreground">Topics you should revisit, based on your recent quiz scores, confidence, and progress.</p>
      </div>

      {isLoading && <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>}
      {isError && <ErrorState message="We could not load your revision list." onRetry={() => void refetch()} />}
      {data && data.length === 0 && <EmptyState icon={<RefreshCw className="size-8" aria-hidden="true" />} title="Nothing to revise right now" description="Complete your first quiz to see your performance, and we'll flag anything worth revisiting here." />}
      {data && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((r) => (
            <li key={r.id}>
              <Card className="flex items-start justify-between gap-4 p-5">
                <div className="min-w-0">
                  <Link to="/subjects" className="font-medium hover:underline">{r.topicName}</Link>
                  <p className="text-xs text-muted-foreground">{r.subjectName}</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{r.reason}</p>
                </div>
                <Button
                  variant="ghost" size="sm" aria-label={`Dismiss revision for ${r.topicName}`}
                  onClick={() => dismiss.mutate(r.id, { onError: (e) => toast.error(errorMessage(e)) })}
                  disabled={dismiss.isPending}
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
