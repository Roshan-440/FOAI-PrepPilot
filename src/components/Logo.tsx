import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

export function Logo({ to = '/', className }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2 rounded-md font-semibold tracking-tight', className)} aria-label="PrepPilot home">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground" aria-hidden="true">
        <svg viewBox="0 0 32 32" className="size-5"><path d="M10 23V9h7a4.5 4.5 0 0 1 0 9h-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <span className="text-lg">PrepPilot</span>
    </Link>
  )
}
