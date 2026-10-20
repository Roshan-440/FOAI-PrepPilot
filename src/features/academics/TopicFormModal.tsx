import { useState, type FormEvent } from 'react'
import { DIFFICULTIES, TOPIC_STATUSES, topicInputSchema, type TopicDto, type TopicInput } from '@shared/academics'
import { Alert } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { Modal, SelectField, TextAreaField } from '@/components/ui/Fields'
import { TextField } from '@/components/ui/TextField'
import { splitApiError, validateForm, type FieldErrors } from '@/lib/formErrors'
import { CONFIDENCE_LABEL, DIFFICULTY_LABEL, IMPORTANCE_LABEL, STATUS_LABEL } from './ui'

const FIELDS = ['name', 'description', 'difficulty', 'importance', 'interviewRelevance', 'estimatedMinutes', 'status', 'confidence']

interface Props { open: boolean; topic?: TopicDto; onClose: () => void; onSubmit: (values: TopicInput) => Promise<void> }

export function TopicFormModal({ open, topic, onClose, onSubmit }: Props) {
  return (
    <Modal open={open} title={topic ? 'Edit topic' : 'Add topic'} onClose={onClose}>
      <TopicForm topic={topic} onClose={onClose} onSubmit={onSubmit} />
    </Modal>
  )
}

function TopicForm({ topic, onClose, onSubmit }: Omit<Props, 'open'>) {
  const [v, setV] = useState({
    name: topic?.name ?? '', description: topic?.description ?? '', difficulty: topic?.difficulty ?? 'INTERMEDIATE',
    importance: String(topic?.importance ?? 3), interviewRelevance: String(topic?.interviewRelevance ?? 3),
    estimatedMinutes: String(topic?.estimatedMinutes ?? 60), status: topic?.status ?? 'NOT_STARTED', confidence: topic?.confidence ? String(topic.confidence) : '',
  })
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((cur) => ({ ...cur, [k]: e.target.value }))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [general, setGeneral] = useState<string>()
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    setGeneral(undefined)
    const parsed = validateForm(topicInputSchema, {
      ...v, importance: Number(v.importance), interviewRelevance: Number(v.interviewRelevance),
      estimatedMinutes: v.estimatedMinutes.trim() === '' ? Number.NaN : Number(v.estimatedMinutes), confidence: v.confidence ? Number(v.confidence) : null,
    })
    if (parsed.errors) return setErrors(parsed.errors)
    setErrors({})
    setSaving(true)
    try {
      await onSubmit(parsed.data)
      onClose()
    } catch (err) {
      const r = splitApiError(err, FIELDS)
      setErrors(r.fields)
      setGeneral(r.general)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {general && <Alert tone="error">{general}</Alert>}
      <TextField label="Topic name" value={v.name} onChange={set('name')} error={errors.name} maxLength={120} autoFocus placeholder="e.g. Normalization" />
      <TextAreaField label="Description" optionalLabel value={v.description} onChange={set('description')} error={errors.description} maxLength={500} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Difficulty" value={v.difficulty} onChange={set('difficulty')} error={errors.difficulty}>
          {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}
        </SelectField>
        <TextField label="Estimated study time (minutes)" type="number" inputMode="numeric" min={5} max={1440} value={v.estimatedMinutes} onChange={set('estimatedMinutes')} error={errors.estimatedMinutes} />
        <SelectField label="Importance" value={v.importance} onChange={set('importance')} error={errors.importance}>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{IMPORTANCE_LABEL[n]}</option>)}
        </SelectField>
        <SelectField label="Interview relevance" value={v.interviewRelevance} onChange={set('interviewRelevance')} error={errors.interviewRelevance}>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{IMPORTANCE_LABEL[n]}</option>)}
        </SelectField>
        <SelectField label="Status" value={v.status} onChange={set('status')} error={errors.status}>
          {TOPIC_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </SelectField>
        <SelectField label="Confidence" value={v.confidence} onChange={set('confidence')} error={errors.confidence}>
          <option value="">Not rated</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{CONFIDENCE_LABEL[n]}</option>)}
        </SelectField>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" loading={saving}>{topic ? 'Save changes' : 'Add topic'}</Button>
      </div>
    </form>
  )
}
