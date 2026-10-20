import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'

interface State { failed: boolean }

/** Catches render-time crashes so users get a recovery option instead of a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('UI error boundary caught:', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="max-w-md text-sm text-muted-foreground">An unexpected error occurred while displaying this page. Reloading usually fixes it.</p>
        <Button onClick={() => window.location.reload()}>Reload page</Button>
      </div>
    )
  }
}
