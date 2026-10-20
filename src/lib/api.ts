import type { ApiErrorBody } from '@shared/validation'

/** Error thrown for every failed API call, with a user-safe message. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const SESSION_EXPIRED_EVENT = 'preppilot:session-expired'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

/**
 * Single choke point for all HTTP calls: JSON encoding, cookie credentials,
 * centralized error normalization and session-expiry broadcasting.
 */
export async function api<T = void>(path: string, { method = 'GET', body, signal }: RequestOptions = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection and try again.')
  }

  if (res.status === 204) return undefined as T

  let payload: unknown = null
  try {
    payload = await res.json()
  } catch {
    // Non-JSON body (e.g. a proxy error page): fall through to the generic message.
  }

  if (!res.ok) {
    const err = (payload as ApiErrorBody | null)?.error
    if (res.status === 401 && err?.code === 'SESSION_EXPIRED') {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    }
    throw new ApiError(
      res.status,
      err?.code ?? 'UNKNOWN',
      err?.message ?? 'Something went wrong. Please try again.',
      err?.fieldErrors,
    )
  }
  return payload as T
}

/** Best-effort friendly message for any thrown value. */
export const errorMessage = (err: unknown, fallback = 'Something went wrong. Please try again.'): string =>
  err instanceof ApiError ? err.message : fallback
