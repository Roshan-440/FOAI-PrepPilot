import { useCallback, useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark'
const KEY = 'preppilot-theme'

function read(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light' // light is the default
  } catch {
    return 'light'
  }
}

const listeners = new Set<() => void>()
const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function applyStoredTheme(): void {
  document.documentElement.classList.toggle('dark', read() === 'dark')
}

/** Theme preference is a purely local UI setting, so it lives in localStorage. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read, () => 'light' as Theme)
  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Storage unavailable (private mode): the theme still applies for this page view.
    }
    document.documentElement.classList.toggle('dark', next === 'dark')
    listeners.forEach((l) => l())
  }, [])
  return { theme, setTheme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') }
}
