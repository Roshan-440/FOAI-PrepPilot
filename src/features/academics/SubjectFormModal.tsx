import { useState, type FormEvent } from 'react'
import { SUBJECT_COLORS, subjectInputSchema, type SubjectDto } from '@shared/academics'
import { Alert } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { Modal, SelectField, TextAreaField } from '@/components/ui/Fields'
import { TextField } from '@/components/ui/TextField'
import { splitApiError, validateForm, type FieldErrors } from '@/lib/formErrors'
import { cn } from '@/lib/cn'
import { IMPORTANCE_LABEL, dotClass } from './ui'

const FIELDS = ['name', 'description', 'importance', 'examDate', 'color']

interface Props { open: boolean; subject?: SubjectDto; onClose: () => void; onSubmit: (values: ReturnType<typeof subjectInputSchema.parse>) => Promise<void> }

export function SubjectFormModal({ open, subject, onClose, onSubmit }: Props) {
  return (
    <Modal open={open} title={subject ? 'Edit subject' : 'Add subject'} onClose={onClose}>
      <SubjectForm subject={subject} onClose={onClose} onSubmit={onSubmit} />
    </Modal>
  )
}

function SubjectForm({ subject, onClose, onSubmit }: Omit<Props, 'open'>) {
  const [name, setName] = useState(subject?.name ?? '')
  const [description, setDescription] = useState(subject?.description ?? '')
  const [importance, setImportance] = useState(String(subject?.importance ?? 3))
  const [examDate, setExamDate] = useState(subject?.examDate ?? '')
  const [color, setColor] = useState(subject?.color ?? 'indigo')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [general, setGeneral] = useState<string>()
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    setGeneral(undefined)
    const parsed = validateForm(subjectInputSchema, { name, description, importance: Number(importance), examDate: examDate || null, color })
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
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={100} autoFocus placeholder="e.g. Data Structures" />
      <TextAreaField label="Description" optionalLabel value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description} maxLength={500} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Importance" value={importance} onChange={(e) => setImportance(e.target.value)} error={errors.importance}>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{IMPORTANCE_LABEL[n]}</option>)}
        </SelectField>
        <TextField label="Exam date" optionalLabel type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} error={errors.examDate} />
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Color</legend>
        <div className="flex flex-wrap gap-2">
          {SUBJECT_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={c} aria-pressed={color === c} className={cn('size-9 rounded-full ring-offset-2 ring-offset-card', dotClass(c), color === c && 'ring-2 ring-foreground')} />
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" loading={saving}>{subject ? 'Save changes' : 'Add subject'}</Button>
      </div>
    </form>
  )
}
