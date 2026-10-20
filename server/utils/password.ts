import bcrypt from 'bcryptjs'
import { env } from '../config/env'

// Lower cost under test so the suite stays fast; production always uses 12.
const COST = env.NODE_ENV === 'test' ? 4 : 12

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, COST)
export const verifyPassword = (plain: string, hash: string): Promise<boolean> => bcrypt.compare(plain, hash)

/** Used to burn equivalent CPU time when the email is unknown (prevents user enumeration by timing). */
let dummyHash: Promise<string> | undefined
export const verifyAgainstDummy = async (plain: string): Promise<void> => {
  dummyHash ??= bcrypt.hash('preppilot-dummy-password', COST)
  await bcrypt.compare(plain, await dummyHash)
}
