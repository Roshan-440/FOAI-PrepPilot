import {
  BarChart3, BookOpen, CalendarDays, CalendarRange, ClipboardCheck, LayoutDashboard, ListChecks, MessageSquareText,
  Mic, RefreshCw, Settings, UserRound, type LucideIcon,
} from 'lucide-react'

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }
export interface NavGroup { heading?: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  { items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    heading: 'Study',
    items: [
      { to: '/subjects', label: 'Subjects', icon: BookOpen },
      { to: '/planner', label: 'Study Planner', icon: CalendarRange },
      { to: '/calendar', label: 'Calendar', icon: CalendarDays },
      { to: '/quizzes', label: 'Quizzes', icon: ClipboardCheck },
      { to: '/revision', label: 'Revision', icon: RefreshCw },
    ],
  },
  {
    heading: 'Interview',
    items: [
      { to: '/interview', label: 'Interview Prep', icon: ListChecks, end: true },
      { to: '/interview/questions', label: 'Question Practice', icon: MessageSquareText },
      { to: '/mock-interview', label: 'Mock Interview', icon: Mic },
    ],
  },
  {
    heading: 'Insights',
    items: [
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/assistant', label: 'AI Assistant', icon: MessageSquareText },
    ],
  },
]

export const ACCOUNT_ITEMS: NavItem[] = [
  { to: '/profile', label: 'Profile', icon: UserRound },
  { to: '/settings', label: 'Settings', icon: Settings },
]
