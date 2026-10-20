import { LogOut, Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { NotificationsBell } from '@/components/NotificationsBell'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { ACCOUNT_ITEMS, NAV_GROUPS, type NavItem } from '@/lib/nav'
import { cn } from '@/lib/cn'

function NavItemLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'bg-primary-soft text-primary-text' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )
      }
    >
      <Icon className="size-4.5 shrink-0" aria-hidden="true" />
      {item.label}
    </NavLink>
  )
}

function SidebarContent({ onLogout, loggingOut }: { onLogout: () => void; loggingOut: boolean }) {
  const { user } = useAuth()
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-4">
        <Logo to="/dashboard" />
      </div>
      <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((group, i) => (
          <div key={group.heading ?? i}>
            {group.heading && <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.heading}</p>}
            <div className="space-y-0.5">{group.items.map((item) => <NavItemLink key={item.to} item={item} />)}</div>
          </div>
        ))}
      </nav>
      <div className="shrink-0 space-y-0.5 border-t border-border p-3">
        {ACCOUNT_ITEMS.map((item) => <NavItemLink key={item.to} item={item} />)}
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
        >
          <LogOut className="size-4.5 shrink-0" aria-hidden="true" />
          {loggingOut ? 'Signing out…' : 'Sign out'}
        </button>
        <p className="truncate px-3 pt-2 text-xs text-muted-foreground" title={user?.email}>{user?.email}</p>
      </div>
    </div>
  )
}

export function AppLayout() {
  const { logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  // The drawer is open only for the path it was opened on, so navigating closes it without an effect.
  const [drawerPath, setDrawerPath] = useState<string | null>(null)
  const drawerOpen = drawerPath === location.pathname
  const setDrawerOpen = (open: boolean) => setDrawerPath(open ? location.pathname : null)
  const [loggingOut, setLoggingOut] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  // Drawer: Esc to close, focus moves in on open and back to the trigger on close.
  useEffect(() => {
    if (!drawerOpen) return
    const trigger = menuButtonRef.current
    drawerRef.current?.querySelector<HTMLElement>('a,button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerPath(null)
      if (e.key === 'Tab' && drawerRef.current) {
        const f = drawerRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled])')
        const first = f[0]
        const last = f[f.length - 1]
        if (!first || !last) return
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      trigger?.focus()
    }
  }, [drawerOpen])

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch {
      toast.error('Could not sign out cleanly. Please try again.')
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-card lg:block">
        <SidebarContent onLogout={handleLogout} loggingOut={loggingOut} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div ref={drawerRef} role="dialog" aria-modal="true" aria-label="Navigation menu" className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-card shadow-xl">
            <Button variant="ghost" size="icon" className="absolute right-2 top-3" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
              <X className="size-5" aria-hidden="true" />
            </Button>
            <SidebarContent onLogout={handleLogout} loggingOut={loggingOut} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card/90 px-3 backdrop-blur lg:hidden">
          <Button ref={menuButtonRef} variant="ghost" size="icon" onClick={() => setDrawerOpen(true)} aria-label="Open menu" aria-expanded={drawerOpen}>
            <Menu className="size-5" aria-hidden="true" />
          </Button>
          <Logo to="/dashboard" />
          <div className="flex items-center gap-1"><NotificationsBell /><ThemeToggle /></div>
        </header>
        <div className="hidden items-center justify-end gap-1 px-8 pt-4 lg:flex"><NotificationsBell /><ThemeToggle /></div>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
