import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute, PublicOnlyRoute } from '@/components/RouteGuards'
import { Spinner } from '@/components/ui/Feedback'
import { useAuth } from '@/hooks/useAuth'
import { AppLayout } from '@/layouts/AppLayout'

const LandingPage = lazy(() => import('@/pages/LandingPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const SignupPage = lazy(() => import('@/pages/SignupPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'))
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const SubjectsPage = lazy(() => import('@/pages/SubjectsPage'))
const SubjectDetailPage = lazy(() => import('@/pages/SubjectDetailPage'))
const PlannerPage = lazy(() => import('@/pages/PlannerPage'))
const CalendarPage = lazy(() => import('@/pages/CalendarPage'))
const QuizzesPage = lazy(() => import('@/pages/QuizzesPage'))
const QuizTakePage = lazy(() => import('@/pages/QuizTakePage'))
const RevisionPage = lazy(() => import('@/pages/RevisionPage'))
const InterviewPage = lazy(() => import('@/pages/InterviewPage'))
const MockInterviewPage = lazy(() => import('@/pages/MockInterviewPage'))
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'))
const AssistantPage = lazy(() => import('@/pages/AssistantPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="size-8" label="Loading page" />
    </div>
  )
}

/** Signed-in users who haven't finished onboarding are kept on /onboarding until they do (or explicitly skip). */
function OnboardingGate() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <PageLoader />
  if (user && !user.onboardingCompleted) return <OnboardingPage />
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Route>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<OnboardingGate />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/subjects" element={<SubjectsPage />} />
            <Route path="/subjects/:id" element={<SubjectDetailPage />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/quizzes" element={<QuizzesPage />} />
            <Route path="/quizzes/:id" element={<QuizTakePage />} />
            <Route path="/revision" element={<RevisionPage />} />
            <Route path="/interview" element={<InterviewPage />} />
            <Route path="/interview/questions" element={<InterviewPage />} />
            <Route path="/mock-interview" element={<MockInterviewPage />} />
            <Route path="/mock-interview/:id" element={<MockInterviewPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/assistant" element={<AssistantPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
