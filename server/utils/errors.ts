/** Error with a stable machine code and a user-safe message. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const badRequest = (message: string, code = 'BAD_REQUEST') => new AppError(400, code, message)
export const unauthorized = (message = 'Please sign in to continue.', code = 'UNAUTHORIZED') =>
  new AppError(401, code, message)
export const notFound = (message = 'Not found.') => new AppError(404, 'NOT_FOUND', message)
export const conflict = (message: string, code = 'CONFLICT', fieldErrors?: Record<string, string>) =>
  new AppError(409, code, message, fieldErrors)

/** Postgres error code, whether raised directly or wrapped by the ORM (`cause`). */
export function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null
  const code = e?.code ?? e?.cause?.code
  return typeof code === 'string' ? code : undefined
}
