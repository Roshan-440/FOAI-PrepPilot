import { CheckCircle2, AlertCircle, X } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type ToastTone = 'success' | 'error' | 'info'
interface ToastItem { id: number; tone: ToastTone; message: string }
interface ToastApi { success(message: string): void; error(message: string): void; info(message: string): void }

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setItems((cur) => cur.filter((t) => t.id !== id)), [])
  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++
      setItems((cur) => [...cur.slice(-3), { id, tone, message }])
      window.setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({ success: (m) => push('success', m), error: (m) => push('error', m), info: (m) => push('info', m) }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border bg-card p-3 text-sm shadow-lg',
              t.tone === 'error' ? 'border-destructive/40' : 'border-border',
            )}
          >
            {t.tone === 'error' ? (
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            )}
            <p className="min-w-0 flex-1 break-words">{t.message}</p>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="rounded p-0.5 text-muted-foreground hover:text-foreground">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
