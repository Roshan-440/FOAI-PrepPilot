import { AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center">
      <Loader2 className={cn('size-5 animate-spin text-primary', className)} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-muted', className)} />
}

const tones = {
  error: { box: 'border-destructive/30 bg-destructive-soft text-destructive', Icon: AlertCircle },
  success: { box: 'border-success/30 bg-success-soft text-success', Icon: CheckCircle2 },
  info: { box: 'border-primary/30 bg-primary-soft text-primary-text', Icon: Info },
  warning: { box: 'border-warning/30 bg-warning-soft text-warning', Icon: AlertCircle },
} as const

/** Inline message banner. Errors are announced immediately to assistive tech. */
export function Alert({ tone = 'info', children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  const { box, Icon } = tones[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-2.5 rounded-lg border p-3 text-sm', box, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** Friendly error panel with an optional retry action. Never shows technical details. */
export function ErrorState({ message = 'Something went wrong. Please try again.', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-8 text-center">
      <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-8 text-center">
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  )
}
