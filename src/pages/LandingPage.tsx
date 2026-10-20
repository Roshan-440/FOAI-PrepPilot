import {
  ArrowRight, BarChart3, BookOpenCheck, BrainCircuit, CalendarClock, ClipboardCheck, Mic, RefreshCw, SearchCheck, type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { buttonVariants } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'

const STEPS = [
  { title: 'Tell us your goals', body: 'Add your subjects, topics, target role and how many hours you can study each day.' },
  { title: 'See what needs attention', body: 'PrepPilot scores every topic on a transparent formula and explains exactly why it matters.' },
  { title: 'Follow an adaptive plan', body: 'Get a realistic schedule that reshuffles itself when you finish, miss or struggle with a topic.' },
  { title: 'Practice and measure', body: 'Take quizzes, run mock interviews and watch your readiness score climb.' },
]

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: CalendarClock, title: 'Adaptive Study Planning', body: 'Schedules that respect your daily hours, study days and deadlines, and tell you honestly when the workload cannot fit.' },
  { icon: SearchCheck, title: 'Knowledge Gap Detection', body: 'A transparent, weighted priority score combines progress, quiz results, confidence and deadlines, with the reasons shown.' },
  { icon: RefreshCw, title: 'Smart Revision', body: 'Revision suggestions based on how long ago you studied, your scores and how confident you feel.' },
  { icon: ClipboardCheck, title: 'AI Quizzes', body: 'Multiple choice, true/false and short answer quizzes for a topic, a subject, or your weakest areas.' },
  { icon: BookOpenCheck, title: 'Interview Preparation', body: 'Technical, HR, behavioral and project questions tailored to your target role, skills and difficulty level.' },
  { icon: Mic, title: 'AI Mock Interviews', body: 'Answer one question at a time, get scored feedback on each, and finish with a full report.' },
  { icon: BarChart3, title: 'Readiness Tracking', body: 'Academic, interview and overall readiness scores with the contributing factors and next steps.' },
]

export default function LandingPage() {
  const { user } = useAuth()
  const ctaTo = user ? '/dashboard' : '/signup'
  const ctaLabel = user ? 'Go to dashboard' : 'Get Started'

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
            <a href="#how-it-works" className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground md:block">How it works</a>
            <a href="#features" className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground md:block">Features</a>
            <ThemeToggle />
            {!user && <Link to="/login" className={cn(buttonVariants({ variant: 'ghost', size: 'md' }))}>Log in</Link>}
            <Link to={ctaTo} className={cn(buttonVariants({ size: 'md' }), 'hidden sm:inline-flex')}>{ctaLabel}</Link>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 text-center sm:px-6 sm:pt-20 lg:pt-28">
          <p className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <BrainCircuit className="size-3.5 text-primary-text" aria-hidden="true" /> Adaptive preparation for students
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Study Smarter. Prepare Better. Get Interview Ready.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            PrepPilot analyzes your learning progress, identifies what needs attention, builds an adaptive study plan, and helps you prepare for interviews.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to={ctaTo} className={cn(buttonVariants({ size: 'lg' }), 'w-full sm:w-auto')}>
              {ctaLabel} <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <a href="#how-it-works" className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'w-full sm:w-auto')}>See how it works</a>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 border-y border-border bg-card py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-text" aria-hidden="true">{i + 1}</span>
                  <h3 className="mt-3 font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className="scroll-mt-20 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">Everything you need to prepare with confidence</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <Card key={title} className="p-5">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary-text"><Icon className="size-5" aria-hidden="true" /></span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6">
          <Card className="mx-auto max-w-4xl bg-primary-soft p-8 text-center sm:p-12">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Know exactly what to study next</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Create a free account and turn your syllabus into a plan you can actually follow.</p>
            <Link to={ctaTo} className={cn(buttonVariants({ size: 'lg' }), 'mt-6')}>{ctaLabel}</Link>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-3"><Logo /><span>Study smarter. Get interview ready.</span></div>
          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <a href="#how-it-works" className="hover:text-foreground">How it works</a>
            <a href="#features" className="hover:text-foreground">Features</a>
            <Link to="/login" className="hover:text-foreground">Log in</Link>
            <Link to="/signup" className="hover:text-foreground">Sign up</Link>
          </nav>
        </div>
        <p className="border-t border-border py-4 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} PrepPilot</p>
      </footer>
    </div>
  )
}
