import type { ZodType } from 'zod'
import { ApiError } from '@/lib/api'

export type FieldErrors = Record<string, string>

/** Runs a zod schema on form values; returns parsed data or per-field messages. */
export function validateForm<T>(schema: ZodType<T>, values: unknown): { data: T; errors?: undefined } | { data?: undefined; errors: FieldErrors } {
  const result = schema.safeParse(values)
  if (result.success) return { data: result.data }
  const errors: FieldErrors = {}
  for (const issue of result.error.issues) errors[issue.path.join('.') || '_'] ??= issue.message
  return { errors }
}

/** Splits an API error into field-level messages and a general banner message. */
export function splitApiError(err: unknown, knownFields: string[]): { fields: FieldErrors; general?: string } {
  if (!(err instanceof ApiError)) return { fields: {}, general: 'Something went wrong. Please try again.' }
  const fields: FieldErrors = {}
  let hadUnmatched = !err.fieldErrors
  for (const [key, msg] of Object.entries(err.fieldErrors ?? {})) {
    if (knownFields.includes(key)) fields[key] = msg
    else hadUnmatched = true
  }
  return { fields, general: hadUnmatched || Object.keys(fields).length === 0 ? err.message : undefined }
}
