import { eq, inArray, sql } from 'drizzle-orm'
import type { ProfileDto, ProfileInput } from '../../shared/academics'
import { db, schema } from '../db/client'
import { notFound } from '../utils/errors'

const { users, profiles, skills, userSkills } = schema

export async function getProfile(userId: string): Promise<ProfileDto> {
  const [row] = await db
    .select({ user: users, profile: profiles })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, userId))
  if (!row) throw notFound('Account not found.')
  const skillRows = await db
    .select({ name: skills.displayName })
    .from(userSkills)
    .innerJoin(skills, eq(skills.id, userSkills.skillId))
    .where(eq(userSkills.userId, userId))
    .orderBy(skills.displayName)
  const p = row.profile
  return {
    name: row.user.name,
    email: row.user.email,
    degree: p?.degree ?? null,
    department: p?.department ?? null,
    semester: p?.semester ?? null,
    targetRole: p?.targetRole ?? null,
    targetIndustry: p?.targetIndustry ?? null,
    skills: skillRows.map((s) => s.name),
    availableHoursPerDay: p?.availableHoursPerDay ?? null,
    preferredSessionMinutes: p?.preferredSessionMinutes ?? null,
    preferredStudyDays: p?.preferredStudyDays ?? [],
    examDate: p?.examDate ?? null,
    interviewDate: p?.interviewDate ?? null,
    onboardingCompleted: p?.onboardingCompleted ?? false,
  }
}

/** Only fields present in `input` change; `null` clears a field. */
export async function updateProfile(userId: string, input: ProfileInput): Promise<ProfileDto> {
  await db.transaction(async (tx) => {
    if (input.name !== undefined) await tx.update(users).set({ name: input.name }).where(eq(users.id, userId))

    const patch: Partial<typeof profiles.$inferInsert> = {}
    if (input.degree !== undefined) patch.degree = input.degree
    if (input.department !== undefined) patch.department = input.department
    if (input.semester !== undefined) patch.semester = input.semester
    if (input.targetRole !== undefined) patch.targetRole = input.targetRole
    if (input.targetIndustry !== undefined) patch.targetIndustry = input.targetIndustry
    if (input.availableHoursPerDay !== undefined) patch.availableHoursPerDay = input.availableHoursPerDay
    if (input.preferredSessionMinutes !== undefined) patch.preferredSessionMinutes = input.preferredSessionMinutes
    if (input.preferredStudyDays !== undefined) patch.preferredStudyDays = [...new Set(input.preferredStudyDays)].sort()
    if (input.examDate !== undefined) patch.examDate = input.examDate
    if (input.interviewDate !== undefined) patch.interviewDate = input.interviewDate
    if (input.completeOnboarding) patch.onboardingCompleted = true

    await tx
      .insert(profiles)
      .values({ userId, ...patch })
      .onConflictDoUpdate({ target: profiles.userId, set: { ...patch, updatedAt: sql`now()` } })

    if (input.skills !== undefined) {
      // De-duplicate case-insensitively, keeping the first spelling the user typed.
      const byKey = new Map<string, string>()
      for (const s of input.skills) if (!byKey.has(s.toLowerCase())) byKey.set(s.toLowerCase(), s)
      const keys = [...byKey.keys()]
      await tx.delete(userSkills).where(eq(userSkills.userId, userId))
      if (keys.length > 0) {
        await tx
          .insert(skills)
          .values(keys.map((k) => ({ name: k, displayName: byKey.get(k) as string })))
          .onConflictDoNothing({ target: skills.name })
        const rows = await tx.select({ id: skills.id }).from(skills).where(inArray(skills.name, keys))
        await tx.insert(userSkills).values(rows.map((r) => ({ userId, skillId: r.id })))
      }
    }
  })
  return getProfile(userId)
}

