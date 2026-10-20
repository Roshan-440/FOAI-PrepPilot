import { Eye, EyeOff } from 'lucide-react'
import { useId, useState, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  error?: string
  hint?: string
  optionalLabel?: boolean
}

/** Labelled input with accessible error/hint wiring (aria-invalid, aria-describedby). */
export function TextField({ label, error, hint, optionalLabel, className, type = 'text', ...props }: TextFieldProps) {
  const id = useId()
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {optionalLabel && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && revealed ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-11 w-full rounded-lg border bg-card px-3 text-base placeholder:text-muted-foreground/70 sm:text-sm',
            error ? 'border-destructive' : 'border-input',
            isPassword && 'pr-11',
            className,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground hover:text-foreground"
          >
            {revealed ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
