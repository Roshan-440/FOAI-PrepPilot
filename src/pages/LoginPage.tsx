import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginSchema } from '@shared/validation'
import { Alert } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useAuth } from '@/hooks/useAuth'
import { AuthLayout } from '@/layouts/AuthLayout'
import { splitApiError, validateForm, type FieldErrors } from '@/lib/formErrors'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'
  const notice = (location.state as { notice?: string } | null)?.notice

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [general, setGeneral] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setGeneral(undefined)
    const parsed = validateForm(loginSchema, { email, password })
    if (parsed.errors) return setErrors(parsed.errors)
    setErrors({})
    setSubmitting(true)
    try {
      await login(parsed.data)
      navigate(from, { replace: true })
    } catch (err) {
      const { fields, general } = splitApiError(err, ['email', 'password'])
      setErrors(fields)
      setGeneral(general)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue your preparation."
      footer={<>New to PrepPilot? <Link to="/signup" className="font-medium text-primary-text hover:underline">Create an account</Link></>}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {notice && <Alert tone="success">{notice}</Alert>}
        {general && <Alert tone="error">{general}</Alert>}
        <TextField label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        <div className="text-right">
          <Link to="/forgot-password" className="text-sm font-medium text-primary-text hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  )
}
