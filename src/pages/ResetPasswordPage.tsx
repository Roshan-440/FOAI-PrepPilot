import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PASSWORD_HINT, resetPasswordSchema } from '@shared/validation'
import { Alert } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { AuthLayout } from '@/layouts/AuthLayout'
import { api } from '@/lib/api'
import { splitApiError, validateForm, type FieldErrors } from '@/lib/formErrors'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [general, setGeneral] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setGeneral(undefined)
    const parsed = validateForm(resetPasswordSchema, { token, password })
    if (parsed.errors) return setErrors(parsed.errors.password ? { password: parsed.errors.password } : {})
    if (password !== confirm) return setErrors({ confirm: 'Passwords do not match.' })
    setErrors({})
    setSubmitting(true)
    try {
      await api('/auth/reset-password', { method: 'POST', body: parsed.data })
      navigate('/login', { replace: true, state: { notice: 'Password updated. Please sign in with your new password.' } })
    } catch (err) {
      const { fields, general } = splitApiError(err, ['password'])
      setErrors(fields)
      setGeneral(general)
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Reset link missing" footer={<Link to="/forgot-password" className="font-medium text-primary-text hover:underline">Request a new link</Link>}>
        <Alert tone="error">This password reset link is incomplete. Please request a new one.</Alert>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Pick a strong password you haven't used before.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {general && (
          <Alert tone="error">
            {general} <Link to="/forgot-password" className="font-medium underline">Request a new link</Link>
          </Alert>
        )}
        <TextField label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint={PASSWORD_HINT} />
        <TextField label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />
        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          {submitting ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </AuthLayout>
  )
}
