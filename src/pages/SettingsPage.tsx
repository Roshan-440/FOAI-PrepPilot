import { LogOut, Moon, Sun } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const toast = useToast()

  async function onLogout() {
    await logout()
    navigate('/', { replace: true })
    toast.info('You have been signed out.')
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Card className="p-5 sm:p-6">
        <h2 className="font-semibold">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose how PrepPilot looks on this device.</p>
        <div className="mt-4 flex gap-2">
          <Button variant={theme === 'light' ? 'primary' : 'secondary'} size="sm" onClick={() => setTheme('light')}>
            <Sun className="size-4" aria-hidden="true" />Light
          </Button>
          <Button variant={theme === 'dark' ? 'primary' : 'secondary'} size="sm" onClick={() => setTheme('dark')}>
            <Moon className="size-4" aria-hidden="true" />Dark
          </Button>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="font-semibold">Account</h2>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Name</dt><dd className="font-medium">{user?.name}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Email</dt><dd className="font-medium">{user?.email}</dd></div>
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">
          Update your academic and career details on your <Link to="/profile" className="font-medium text-primary-text hover:underline">Profile</Link> page.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          To change your password, sign out and use <Link to="/forgot-password" className="font-medium text-primary-text hover:underline">Forgot password</Link>.
        </p>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="font-semibold">Session</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sign out of PrepPilot on this device.</p>
        <Button variant="secondary" className="mt-4" onClick={() => void onLogout()}>
          <LogOut className="size-4" aria-hidden="true" />Sign out
        </Button>
      </Card>
    </div>
  )
}
