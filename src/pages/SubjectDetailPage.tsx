import { ArrowLeft, ListPlus, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { TOPIC_STATUSES, type TopicDto, type TopicStatus } from '@shared/academics'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { ProgressBar } from '@/components/ui/Fields'
import { useToast } from '@/components/ui/Toast'
import { ApiError, errorMessage } from '@/lib/api'
import { ConfirmDialog } from '@/features/academics/ConfirmDialog'
import { SubjectFormModal } from '@/features/academics/SubjectFormModal'
import { TopicFormModal } from '@/features/academics/TopicFormModal'
import { CONFIDENCE_LABEL, DIFFICULTY_LABEL, IMPORTANCE_LABEL, STATUS_LABEL, STATUS_TONE, dotClass } from '@/features/academics/ui'
import { useCreateTopic, useDeleteSubject, useDeleteTopic, useSubjectDetail, useUpdateSubject, useUpdateTopic } from '@/services/academics'

const selectCls = 'h-9 rounded-lg border border-input bg-card px-2 text-sm'

function TopicRow({ topic, onEdit, onDelete }: { topic: TopicDto; onEdit: () => void; onDelete: () => void }) {
  const update = useUpdateTopic()
  const toast = useToast()
  const patch = (p: Parameters<typeof update.mutate>[0]['patch']) =>
    update.mutate({ id: topic.id, patch: p }, { onError: (e) => toast.error(errorMessage(e, 'Could not update the topic.')) })
  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words font-medium">{topic.name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {DIFFICULTY_LABEL[topic.difficulty]} · Importance: {IMPORTANCE_LABEL[topic.importance]} · Interview relevance: {IMPORTANCE_LABEL[topic.interviewRelevance]} · ~{topic.estimatedMinutes} min
          </p>
          {topic.description && <p className="mt-1.5 text-sm text-muted-foreground">{topic.description}</p>}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[topic.status]}`}>{STATUS_LABEL[topic.status]}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">Status
          <select className={`${selectCls} mt-1 block`} value={topic.status} disabled={update.isPending} onChange={(e) => patch({ status: e.target.value as TopicStatus })}>
            {TOPIC_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">Confidence
          <select className={`${selectCls} mt-1 block`} value={topic.confidence ?? ''} disabled={update.isPending} onChange={(e) => patch({ confidence: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Not rated</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{CONFIDENCE_LABEL[n]}</option>)}
          </select>
        </label>
        <p className="text-xs text-muted-foreground">
          Last studied: {topic.lastStudiedAt ? new Date(topic.lastStudiedAt).toLocaleDateString() : 'never'}<br />
          Last score: {topic.lastScore === null ? 'no quiz yet' : `${topic.lastScore}%`}
        </p>
        <div className="ml-auto flex gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit} aria-label={`Edit ${topic.name}`}><Pencil className="size-4" aria-hidden="true" /></Button>
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label={`Delete ${topic.name}`}><Trash2 className="size-4" aria-hidden="true" /></Button>
        </div>
      </div>
    </li>
  )
}

export default function SubjectDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { data, isLoading, error, refetch } = useSubjectDetail(id)
  const updateSubject = useUpdateSubject(id)
  const deleteSubject = useDeleteSubject()
  const createTopic = useCreateTopic(id)
  const updateTopic = useUpdateTopic()
  const deleteTopic = useDeleteTopic()
  const [editingSubject, setEditingSubject] = useState(false)
  const [deletingSubject, setDeletingSubject] = useState(false)
  const [topicModal, setTopicModal] = useState<{ topic?: TopicDto } | null>(null)
  const [topicToDelete, setTopicToDelete] = useState<TopicDto | null>(null)

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-24" /><Skeleton className="h-32" /></div>
  if (error instanceof ApiError && error.status === 404) {
    return <EmptyState title="Subject not found" description="It may have been deleted." action={<Link to="/subjects" className="text-sm font-medium text-primary-text hover:underline">Back to subjects</Link>} />
  }
  if (error || !data) return <ErrorState message="We could not load this subject." onRetry={() => void refetch()} />
  const { subject, topics } = data

  return (
    <div className="space-y-6">
      <Link to="/subjects" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />All subjects</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5"><span className={`size-3 rounded-full ${dotClass(subject.color)}`} aria-hidden="true" /><h1 className="break-words text-2xl font-semibold tracking-tight">{subject.name}</h1></div>
          {subject.description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{subject.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditingSubject(true)}><Pencil className="size-4" aria-hidden="true" />Edit</Button>
          <Button variant="secondary" size="sm" onClick={() => setDeletingSubject(true)}><Trash2 className="size-4" aria-hidden="true" />Delete</Button>
        </div>
      </div>

      <Card className="p-5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">{subject.topicCount === 0 ? 'No topics yet' : `${subject.completedCount} of ${subject.topicCount} topics completed`}</span>
          <span className="text-lg font-semibold tabular-nums">{subject.completionPercent}%</span>
        </div>
        <ProgressBar value={subject.completionPercent} label="Subject completion" className="mt-2" />
        <p className="mt-3 text-xs text-muted-foreground">Importance: {IMPORTANCE_LABEL[subject.importance]}{subject.examDate ? ` · Exam: ${new Date(`${subject.examDate}T00:00:00`).toLocaleDateString()}` : ''}</p>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Topics</h2>
        <Button size="sm" onClick={() => setTopicModal({})}><ListPlus className="size-4" aria-hidden="true" />Add topic</Button>
      </div>
      {topics.length === 0 ? (
        <EmptyState title="No topics yet" description="Add topics to begin tracking your progress." action={<Button onClick={() => setTopicModal({})}>Add topic</Button>} />
      ) : (
        <ul className="space-y-3">{topics.map((t) => <TopicRow key={t.id} topic={t} onEdit={() => setTopicModal({ topic: t })} onDelete={() => setTopicToDelete(t)} />)}</ul>
      )}

      <SubjectFormModal open={editingSubject} subject={subject} onClose={() => setEditingSubject(false)} onSubmit={async (v) => { await updateSubject.mutateAsync(v); toast.success('Subject updated.') }} />
      <TopicFormModal
        open={topicModal !== null}
        topic={topicModal?.topic}
        onClose={() => setTopicModal(null)}
        onSubmit={async (v) => {
          if (topicModal?.topic) await updateTopic.mutateAsync({ id: topicModal.topic.id, patch: v })
          else await createTopic.mutateAsync(v)
          toast.success(topicModal?.topic ? 'Topic updated.' : 'Topic added.')
        }}
      />
      <ConfirmDialog open={deletingSubject} title="Delete this subject?" message={`“${subject.name}” and all of its ${subject.topicCount} topics will be permanently deleted.`} confirmLabel="Delete subject"
        onClose={() => setDeletingSubject(false)} onConfirm={async () => { try { await deleteSubject.mutateAsync(subject.id); toast.success('Subject deleted.'); navigate('/subjects', { replace: true }) } catch (e) { toast.error(errorMessage(e)); throw e } }} />
      <ConfirmDialog open={topicToDelete !== null} title="Delete this topic?" message={`“${topicToDelete?.name ?? ''}” will be permanently deleted.`} confirmLabel="Delete topic"
        onClose={() => setTopicToDelete(null)} onConfirm={async () => { if (!topicToDelete) return; try { await deleteTopic.mutateAsync(topicToDelete.id); toast.success('Topic deleted.') } catch (e) { toast.error(errorMessage(e)); throw e } }} />
    </div>
  )
}
