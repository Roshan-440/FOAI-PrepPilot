import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Spinner } from '@/components/ui/Feedback'
import { useAuth } from '@/hooks/useAuth'

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="size-8" label="Loading your workspace" />
    </div>
  )
}

/** Only signed-in users may pass; others are sent to /login and returned afterwards.
 *  Signed-in users who haven't finished onboarding are sent there first, except on /onboarding itself. */
export function ProtectedRoute() {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (!user.onboardingCompleted && location.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />
  return <Outlet />
}

/** Login/signup are pointless for signed-in users, so redirect them to the dashboard. */
export function PublicOnlyRoute() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <FullPageSpinner />
  if (user) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
