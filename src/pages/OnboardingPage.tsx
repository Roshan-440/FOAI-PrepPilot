import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { profileInputSchema } from '@shared/academics'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Feedback'
import { ChipInput, ProgressBar, SelectField } from '@/components/ui/Fields'
import { TextField } from '@/components/ui/TextField'
import { useToast } from '@/components/ui/Toast'
import { DEGREES, SEMESTERS, TARGET_ROLES, WEEKDAYS, emptyOnboardingState, type OnboardingState } from '@/features/onboarding/steps'
import { useAuth } from '@/hooks/useAuth'
import { errorMessage } from '@/lib/api'
import { useCreateSubject, useSaveProfile } from '@/services/academics'

const STEPS = ['Personal information', 'Academic information', 'Subjects', 'Skills', 'Career target', 'Study preferences'] as const
const set = <K extends keyof OnboardingState>(setState: React.Dispatch<React.SetStateAction<OnboardingState>>, key: K) => (value: OnboardingState[K]) =>
  setState((s) => ({ ...s, [key]: value }))

export default function OnboardingPage() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const saveProfile = useSaveProfile()
  const createSubject = useCreateSubject()
  const [step, setStep] = useState(0)
  const [state, setState] = useState<OnboardingState>(() => emptyOnboardingState(user?.name ?? ''))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()
  const last = step === STEPS.length - 1

  async function finish() {
    setSubmitting(true)
    setError(undefined)
    try {
      const input = profileInputSchema.parse({
        name: state.name.trim() || undefined,
        degree: state.degree || null,
        department: state.department.trim() || null,
        semester: state.semester || null,
        targetRole: state.targetRole || null,
        targetIndustry: state.targetIndustry.trim() || null,
        skills: state.skills,
        availableHoursPerDay: state.availableHoursPerDay ? Number(state.availableHoursPerDay) : null,
        preferredSessionMinutes: state.preferredSessionMinutes ? Number(state.preferredSessionMinutes) : null,
        preferredStudyDays: state.preferredStudyDays,
        examDate: state.examDate || null,
        interviewDate: state.interviewDate || null,
        completeOnboarding: true,
      })
      await saveProfile.mutateAsync(input)
      // Subjects are optional: create the ones the student listed, skipping blanks; duplicates are ignored quietly.
      for (const name of state.subjects) {
        try {
          await createSubject.mutateAsync({ name, importance: 3, color: 'indigo' })
        } catch {
          /* duplicate or invalid name — not worth blocking onboarding over */
        }
      }
      await refresh()
      toast.success('Your profile is set up.')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'We could not save your profile. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  function next() {
    if (last) return void finish()
    setStep((s) => s + 1)
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-sm font-medium text-muted-foreground">Step {step + 1} of {STEPS.length}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{STEPS[step]}</h1>
      <ProgressBar value={((step + 1) / STEPS.length) * 100} label="Onboarding progress" className="mt-4" />

      <Card className="mt-6 p-5 sm:p-6">
        {error && <Alert tone="error" className="mb-4">{error}</Alert>}

        {step === 0 && (
          <div className="space-y-4">
            <TextField label="Full name" value={state.name} onChange={(e) => set(setState, 'name')(e.target.value)} maxLength={100} autoFocus />
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Degree" optionalLabel value={state.degree} onChange={(e) => set(setState, 'degree')(e.target.value)}>
              <option value="">Prefer not to say</option>
              {DEGREES.map((d) => <option key={d} value={d}>{d}</option>)}
            </SelectField>
            <TextField label="Department" optionalLabel placeholder="e.g. Computer Science" value={state.department} onChange={(e) => set(setState, 'department')(e.target.value)} />
            <SelectField label="Semester / year" optionalLabel value={state.semester} onChange={(e) => set(setState, 'semester')(e.target.value)}>
              <option value="">Prefer not to say</option>
              {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
            </SelectField>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <ChipInput label="Subjects you're studying" values={state.subjects} onChange={set(setState, 'subjects')} placeholder="e.g. Data Structures" hint="Press Enter to add. You can add more anytime." />
            <p className="text-xs text-muted-foreground">Skip this if you'd rather add subjects later from the Subjects page.</p>
          </div>
        )}

        {step === 3 && (
          <ChipInput label="Skills & technologies" values={state.skills} onChange={set(setState, 'skills')} placeholder="e.g. Python, React, SQL" />
        )}

        {step === 4 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Target role" optionalLabel value={state.targetRole} onChange={(e) => set(setState, 'targetRole')(e.target.value)}>
              <option value="">Not decided yet</option>
              {TARGET_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </SelectField>
            <TextField label="Target industry" optionalLabel placeholder="e.g. Fintech" value={state.targetIndustry} onChange={(e) => set(setState, 'targetIndustry')(e.target.value)} />
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Available hours/day" type="number" inputMode="decimal" min={0.5} max={16} step={0.5} value={state.availableHoursPerDay} onChange={(e) => set(setState, 'availableHoursPerDay')(e.target.value)} />
              <TextField label="Preferred session length (min)" type="number" inputMode="numeric" min={15} max={240} step={15} value={state.preferredSessionMinutes} onChange={(e) => set(setState, 'preferredSessionMinutes')(e.target.value)} />
            </div>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Preferred study days</legend>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => {
                  const active = state.preferredStudyDays.includes(d.value)
                  return (
                    <button key={d.value} type="button" aria-pressed={active}
                      onClick={() => set(setState, 'preferredStudyDays')(active ? state.preferredStudyDays.filter((v) => v !== d.value) : [...state.preferredStudyDays, d.value].sort())}
                      className={`h-9 rounded-lg border px-3 text-sm font-medium ${active ? 'border-primary bg-primary-soft text-primary-text' : 'border-input text-muted-foreground'}`}>
                      {d.label}
                    </button>
                  )
                })}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Exam date" optionalLabel type="date" value={state.examDate} onChange={(e) => set(setState, 'examDate')(e.target.value)} />
              <TextField label="Interview date" optionalLabel type="date" value={state.interviewDate} onChange={(e) => set(setState, 'interviewDate')(e.target.value)} />
            </div>
          </div>
        )}

        <div className="mt-7 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || submitting}>Back</Button>
          <div className="flex gap-2">
            {!last && <Button variant="secondary" onClick={() => void finish()} disabled={submitting}>Skip remaining & finish</Button>}
            <Button onClick={next} loading={submitting}>{last ? 'Finish' : 'Continue'}</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
