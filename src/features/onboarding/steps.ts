export const DEGREES = ['B.Tech', 'B.E.', 'B.Sc', 'BCA', 'M.Tech', 'M.Sc', 'MCA', 'Other'] as const
export const SEMESTERS = ['1', '2', '3', '4', '5', '6', '7', '8', 'Graduated'] as const
export const TARGET_ROLES = [
  'Software Developer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
  'Data Analyst', 'Data Scientist', 'AI/ML Engineer', 'QA Engineer', 'DevOps Engineer', 'Other',
] as const
export const WEEKDAYS = [
  { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' }, { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' }, { value: 7, label: 'Sun' },
] as const

export interface OnboardingState {
  name: string
  degree: string
  department: string
  semester: string
  subjects: string[]
  skills: string[]
  targetRole: string
  targetIndustry: string
  availableHoursPerDay: string
  preferredSessionMinutes: string
  preferredStudyDays: number[]
  examDate: string
  interviewDate: string
}

export const emptyOnboardingState = (name: string): OnboardingState => ({
  name, degree: '', department: '', semester: '', subjects: [], skills: [], targetRole: '', targetIndustry: '',
  availableHoursPerDay: '2', preferredSessionMinutes: '45', preferredStudyDays: [1, 2, 3, 4, 5], examDate: '', interviewDate: '',
})
