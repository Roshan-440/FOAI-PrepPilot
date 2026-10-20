import { useState } from 'react'
import { profileInputSchema, type ProfileDto } from '@shared/academics'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Alert, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { ChipInput, SelectField } from '@/components/ui/Fields'
import { TextField } from '@/components/ui/TextField'
import { useToast } from '@/components/ui/Toast'
import { DEGREES, SEMESTERS, TARGET_ROLES, WEEKDAYS } from '@/features/onboarding/steps'
import { useAuth } from '@/hooks/useAuth'
import { errorMessage } from '@/lib/api'
import { useProfile, useSaveProfile } from '@/services/academics'

export default function ProfilePage() {
  const { data: profile, isLoading, isError, refetch } = useProfile()
  if (isLoading) return <div className="max-w-2xl space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96" /></div>
  if (isError || !profile) return <ErrorState message="We could not load your profile." onRetry={() => void refetch()} />
  // Keying on the loaded email/updatedAt-free snapshot means the form only reinitializes when fresh server data arrives, not on every keystroke.
  return <ProfileForm profile={profile} />
}

function ProfileForm({ profile }: { profile: ProfileDto }) {
  const save = useSaveProfile()
  const { refresh } = useAuth()
  const toast = useToast()

  const [form, setForm] = useState(() => ({
    name: profile.name, degree: profile.degree ?? '', department: profile.department ?? '', semester: profile.semester ?? '',
    targetRole: profile.targetRole ?? '', targetIndustry: profile.targetIndustry ?? '', skills: profile.skills,
    availableHoursPerDay: profile.availableHoursPerDay?.toString() ?? '', preferredSessionMinutes: profile.preferredSessionMinutes?.toString() ?? '',
    preferredStudyDays: profile.preferredStudyDays, examDate: profile.examDate ?? '', interviewDate: profile.interviewDate ?? '',
  }))
  const [error, setError] = useState<string>()

  const set = <K extends keyof typeof form>(key: K) => (value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form || save.isPending) return
    setError(undefined)
    try {
      const input = profileInputSchema.parse({
        name: form.name.trim(), degree: form.degree || null, department: form.department.trim() || null, semester: form.semester || null,
        targetRole: form.targetRole || null, targetIndustry: form.targetIndustry.trim() || null, skills: form.skills,
        availableHoursPerDay: form.availableHoursPerDay ? Number(form.availableHoursPerDay) : null,
        preferredSessionMinutes: form.preferredSessionMinutes ? Number(form.preferredSessionMinutes) : null,
        preferredStudyDays: form.preferredStudyDays, examDate: form.examDate || null, interviewDate: form.interviewDate || null,
      })
      await save.mutateAsync(input)
      await refresh()
      toast.success('Profile updated.')
    } catch (err) {
      setError(errorMessage(err, 'We could not save your changes.'))
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">Signed in as {profile?.email}</p>
      </div>
      <form onSubmit={onSubmit} noValidate>
        <Card className="space-y-5 p-5 sm:p-6">
          {error && <Alert tone="error">{error}</Alert>}
          <TextField label="Full name" value={form.name} onChange={(e) => set('name')(e.target.value)} maxLength={100} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Degree" optionalLabel value={form.degree} onChange={(e) => set('degree')(e.target.value)}>
              <option value="">Prefer not to say</option>
              {DEGREES.map((d) => <option key={d} value={d}>{d}</option>)}
            </SelectField>
            <TextField label="Department" optionalLabel value={form.department} onChange={(e) => set('department')(e.target.value)} />
            <SelectField label="Semester / year" optionalLabel value={form.semester} onChange={(e) => set('semester')(e.target.value)}>
              <option value="">Prefer not to say</option>
              {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
            </SelectField>
            <SelectField label="Target role" optionalLabel value={form.targetRole} onChange={(e) => set('targetRole')(e.target.value)}>
              <option value="">Not decided yet</option>
              {TARGET_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </SelectField>
            <TextField label="Target industry" optionalLabel value={form.targetIndustry} onChange={(e) => set('targetIndustry')(e.target.value)} />
          </div>
          <ChipInput label="Skills & technologies" values={form.skills} onChange={set('skills')} placeholder="e.g. Python, React, SQL" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Available hours/day" type="number" inputMode="decimal" min={0.5} max={16} step={0.5} value={form.availableHoursPerDay} onChange={(e) => set('availableHoursPerDay')(e.target.value)} />
            <TextField label="Preferred session length (min)" type="number" inputMode="numeric" min={15} max={240} step={15} value={form.preferredSessionMinutes} onChange={(e) => set('preferredSessionMinutes')(e.target.value)} />
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Preferred study days</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => {
                const active = form.preferredStudyDays.includes(d.value)
                return (
                  <button key={d.value} type="button" aria-pressed={active}
                    onClick={() => set('preferredStudyDays')(active ? form.preferredStudyDays.filter((v) => v !== d.value) : [...form.preferredStudyDays, d.value].sort())}
                    className={`h-9 rounded-lg border px-3 text-sm font-medium ${active ? 'border-primary bg-primary-soft text-primary-text' : 'border-input text-muted-foreground'}`}>
                    {d.label}
                  </button>
                )
              })}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Exam date" optionalLabel type="date" value={form.examDate} onChange={(e) => set('examDate')(e.target.value)} />
            <TextField label="Interview date" optionalLabel type="date" value={form.interviewDate} onChange={(e) => set('interviewDate')(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={save.isPending}>Save changes</Button>
          </div>
        </Card>
      </form>
    </div>
  )
}
