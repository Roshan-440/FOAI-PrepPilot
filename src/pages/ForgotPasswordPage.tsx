import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { forgotPasswordSchema } from '@shared/validation'
import { Alert } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { AuthLayout } from '@/layouts/AuthLayout'
import { api, errorMessage } from '@/lib/api'
import { validateForm, type FieldErrors } from '@/lib/formErrors'

interface ForgotResponse { message: string; devResetUrl?: string }

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [general, setGeneral] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ForgotResponse>()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setGeneral(undefined)
    const parsed = validateForm(forgotPasswordSchema, { email })
    if (parsed.errors) return setErrors(parsed.errors)
    setErrors({})
    setSubmitting(true)
    try {
      setResult(await api<ForgotResponse>('/auth/forgot-password', { method: 'POST', body: parsed.data }))
    } catch (err) {
      setGeneral(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
      footer={<Link to="/login" className="font-medium text-primary-text hover:underline">Back to sign in</Link>}
    >
      {result ? (
        <div className="space-y-4">
          <Alert tone="success">{result.message}</Alert>
          {result.devResetUrl && (
            <Alert tone="warning">
              <p className="font-medium">Development mode: email delivery is simulated.</p>
              <p className="mt-1">No email was sent. Use this link to continue:</p>
              <a href={result.devResetUrl} className="mt-1 block break-all font-medium underline">Open reset link</a>
            </Alert>
          )}
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {general && <Alert tone="error">{general}</Alert>}
          <TextField label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            {submitting ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
