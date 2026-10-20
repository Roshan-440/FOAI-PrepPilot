import { createHash, randomBytes } from 'node:crypto'

/** 256-bit random URL-safe token. The raw value goes to the client; only the hash is stored. */
export const generateToken = (): string => randomBytes(32).toString('base64url')
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex')
