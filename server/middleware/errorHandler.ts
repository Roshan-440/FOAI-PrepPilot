import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'
import type { ApiErrorBody } from '../../shared/validation'
import { AppError } from '../utils/errors'

export const notFoundHandler: RequestHandler = (_req, res) => {
  const body: ApiErrorBody = { error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' } }
  res.status(404).json(body)
}

/** Turns any thrown value into a safe JSON error. Stack traces are logged, never returned. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err)
    return
  }

  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_'
      fieldErrors[key] ??= issue.message
    }
    const body: ApiErrorBody = {
      error: { code: 'VALIDATION_ERROR', message: 'Please check the highlighted fields.', fieldErrors },
    }
    res.status(400).json(body)
    return
  }

  if (err instanceof AppError) {
    const body: ApiErrorBody = {
      error: { code: err.code, message: err.message, ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}) },
    }
    res.status(err.status).json(body)
    return
  }

  // body-parser errors (malformed JSON, payload too large)
  const type = (err as { type?: string } | null)?.type
  if (type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'The request body is not valid JSON.' } })
    return
  }
  if (type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'The request is too large.' } })
    return
  }

  if (process.env.NODE_ENV !== 'test') {
    console.error('[error]', err)
  }
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } })
}
