import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Card } from '@/components/ui/Card'

/** Centered card layout shared by login, signup, and password pages. */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-md">
          <Card className="p-6 sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </Card>
          {footer && <p className="mt-4 text-center text-sm text-muted-foreground">{footer}</p>}
          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="underline-offset-2 hover:underline">Back to home</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
