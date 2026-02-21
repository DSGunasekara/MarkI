import { db, assignments } from '@hiring-engine/db'
import type { NewAssignment } from '@hiring-engine/db'
import { eq } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'

const CREATE_ASSIGNMENT_RETRY_LIMIT = 5

type CreateAssignmentInput = NewAssignment & {
  employerId: string
}

const generateJoinCode = () => {
  return randomBytes(4).toString('hex').toUpperCase()
}

const getUniqueJoinCode = async () => {
  for (let attempt = 0; attempt < CREATE_ASSIGNMENT_RETRY_LIMIT; attempt += 1) {
    const candidateCode = generateJoinCode()
    const existing = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(eq(assignments.joinCode, candidateCode))
      .limit(1)

    if (existing.length === 0) {
      return candidateCode
    }
  }

  throw new Error('Unable to generate a unique assignment join code after retries.')
}

export const assignmentService = {
  createAssignment: async (input: CreateAssignmentInput) => {
    const joinCode = await getUniqueJoinCode()

    const [createdAssignment] = await db
      .insert(assignments)
      .values({
        title: input.title,
        instructions: input.instructions,
        employerId: input.employerId,
        joinCode
      })
      .returning()

    if (!createdAssignment) {
      throw new Error('Failed to persist assignment record.')
    }

    return createdAssignment
  }
}
