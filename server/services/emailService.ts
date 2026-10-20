import { env } from '../config/env'

export interface EmailService {
  sendPasswordReset(to: string, resetUrl: string): Promise<void>
}

/**
 * Development implementation: prints the message to the server console.
 * No email is actually delivered. To go to production, implement `EmailService`
 * with a real provider (SMTP, SES, Resend, ...) and export it from `getEmailService`.
 */
class ConsoleEmailService implements EmailService {
  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    if (env.NODE_ENV === 'test') return
    // eslint-disable-next-line no-console
    console.log(`[email:dev] Password reset for ${to}: ${resetUrl}`)
  }
}

let instance: EmailService | undefined
export function getEmailService(): EmailService {
  instance ??= new ConsoleEmailService()
  return instance
}

/** True when emails are only logged to the console (so the UI may surface the link in dev). */
export const emailDeliveryIsSimulated = (): boolean => env.NODE_ENV !== 'production'
