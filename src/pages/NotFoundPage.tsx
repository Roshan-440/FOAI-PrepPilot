import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'

export default function NotFoundPage() {
  const { user } = useAuth()
  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-semibold text-primary-text">404</p>
      <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="max-w-md text-muted-foreground">The page you are looking for doesn't exist or may have been moved.</p>
      <Link to={user ? '/dashboard' : '/'} className={cn(buttonVariants({ size: 'lg' }))}>{user ? 'Back to dashboard' : 'Back to home'}</Link>
    </main>
  )
}
