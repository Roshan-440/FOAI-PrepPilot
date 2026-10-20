import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PASSWORD_HINT, signupSchema } from '@shared/validation'
import { Alert } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useAuth } from '@/hooks/useAuth'
import { AuthLayout } from '@/layouts/AuthLayout'
import { splitApiError, validateForm, type FieldErrors } from '@/lib/formErrors'

export default function SignupPage() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [general, setGeneral] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setGeneral(undefined)
    const parsed = validateForm(signupSchema, { name, email, password })
    if (parsed.errors) return setErrors(parsed.errors)
    setErrors({})
    setSubmitting(true)
    try {
      await signup(parsed.data)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const { fields, general } = splitApiError(err, ['name', 'email', 'password'])
      setErrors(fields)
      setGeneral(general)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start preparing smarter in under a minute."
      footer={<>Already have an account? <Link to="/login" className="font-medium text-primary-text hover:underline">Sign in</Link></>}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {general && <Alert tone="error">{general}</Alert>}
        <TextField label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <TextField label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <TextField label="Password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint={PASSWORD_HINT} />
        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  )
}
