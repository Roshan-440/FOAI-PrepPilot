import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

interface FieldChrome { label: string; error?: string; hint?: string; optionalLabel?: boolean }

function FieldShell({ id, label, error, hint, optionalLabel, children }: FieldChrome & { id: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {optionalLabel && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  )
}
const describe = (id: string, error?: string, hint?: string) => [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined

export function SelectField({ label, error, hint, optionalLabel, className, children, ...props }: FieldChrome & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'>) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} optionalLabel={optionalLabel}>
      <select id={id} aria-invalid={error ? true : undefined} aria-describedby={describe(id, error, hint)} className={cn('h-11 w-full rounded-lg border bg-card px-3 text-base sm:text-sm', error ? 'border-destructive' : 'border-input', className)} {...props}>
        {children}
      </select>
    </FieldShell>
  )
}

export function TextAreaField({ label, error, hint, optionalLabel, className, ...props }: FieldChrome & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} optionalLabel={optionalLabel}>
      <textarea id={id} rows={3} aria-invalid={error ? true : undefined} aria-describedby={describe(id, error, hint)} className={cn('w-full rounded-lg border bg-card px-3 py-2 text-base sm:text-sm', error ? 'border-destructive' : 'border-input', className)} {...props} />
    </FieldShell>
  )
}

/** Free-text list input: type a value and press Enter (or Add). Duplicates are ignored case-insensitively. */
export function ChipInput({ label, values, onChange, placeholder, max = 40, hint, error }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number; hint?: string; error?: string }) {
  const id = useId()
  const [draft, setDraft] = useState('')
  function add() {
    const v = draft.trim().slice(0, 100)
    if (!v || values.length >= max || values.some((x) => x.toLowerCase() === v.toLowerCase())) return setDraft('')
    onChange([...values, v])
    setDraft('')
  }
  return (
    <FieldShell id={id} label={label} error={error} hint={hint ?? `Press Enter to add. Up to ${max}.`}>
      <div className="flex gap-2">
        <input id={id} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} placeholder={placeholder} maxLength={100} aria-describedby={describe(id, error, hint ?? 'x')} className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-base sm:text-sm" />
        <Button variant="secondary" size="md" onClick={add} disabled={!draft.trim()}>Add</Button>
      </div>
      {values.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label={`${label} added`}>
          {values.map((v) => (
            <li key={v} className="flex items-center gap-1 rounded-full bg-primary-soft py-1 pl-3 pr-1 text-sm text-primary-text">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="rounded-full p-1 hover:bg-primary/10"><X className="size-3.5" aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      )}
    </FieldShell>
  )
}

export function ProgressBar({ value, label, className }: { value: number; label: string; className?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} className={cn('h-2 overflow-hidden rounded-full bg-muted', className)}>
      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${v}%` }} />
    </div>
  )
}

/** Native <dialog>: focus trapping, Esc-to-close and inert background come from the browser. Content mounts only while open, so forms reset. */
export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose() }} className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50">
      {open && (
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
            <Button variant="ghost" size="icon" className="-mr-2 -mt-2" onClick={onClose} aria-label="Close dialog"><X className="size-5" aria-hidden="true" /></Button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}
