import { assignments, db, submissions } from '@hiring-engine/db'
import { and, desc, eq, sql } from 'drizzle-orm'

type CreateCandidateSubmissionInput = {
  candidateId: string
  joinCode: string
  repositoryUrl: string
}

type CandidateOverviewOptions = {
  submissionsLimit: number
}

const DEFAULT_SUBMISSIONS_LIMIT = 12

export const candidateService = {
  createOrReplaceSubmission: async (input: CreateCandidateSubmissionInput) => {
    const normalizedJoinCode = input.joinCode.trim().toUpperCase()

    const [assignmentRecord] = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        joinCode: assignments.joinCode
      })
      .from(assignments)
      .where(eq(assignments.joinCode, normalizedJoinCode))
      .limit(1)

    if (!assignmentRecord) {
      return null
    }

    const [existingSubmission] = await db
      .select({
        id: submissions.id
      })
      .from(submissions)
      .where(
        and(
          eq(submissions.assignmentId, assignmentRecord.id),
          eq(submissions.candidateId, input.candidateId)
        )
      )
      .orderBy(desc(submissions.createdAt))
      .limit(1)

    if (existingSubmission) {
      const [updatedSubmission] = await db
        .update(submissions)
        .set({
          repositoryUrl: input.repositoryUrl,
          status: 'pending',
          updatedAt: new Date()
        })
        .where(eq(submissions.id, existingSubmission.id))
        .returning()

      if (!updatedSubmission) {
        throw new Error('Unable to update existing submission.')
      }

      return {
        assignment: assignmentRecord,
        submission: updatedSubmission,
        isResubmission: true
      }
    }

    const [createdSubmission] = await db
      .insert(submissions)
      .values({
        assignmentId: assignmentRecord.id,
        candidateId: input.candidateId,
        repositoryUrl: input.repositoryUrl,
        status: 'pending'
      })
      .returning()

    if (!createdSubmission) {
      throw new Error('Unable to create submission.')
    }

    return {
      assignment: assignmentRecord,
      submission: createdSubmission,
      isResubmission: false
    }
  },

  getOverview: async (candidateId: string, options?: Partial<CandidateOverviewOptions>) => {
    const submissionsLimit = options?.submissionsLimit ?? DEFAULT_SUBMISSIONS_LIMIT

    const [metrics] = await db
      .select({
        submissionCount: sql<number>`count(${submissions.id})::int`,
        pendingCount: sql<number>`count(*) filter (where ${submissions.status} = 'pending')::int`,
        buildingCount: sql<number>`count(*) filter (where ${submissions.status} = 'building')::int`,
        deployedCount: sql<number>`count(*) filter (where ${submissions.status} = 'deployed')::int`,
        failedCount: sql<number>`count(*) filter (where ${submissions.status} = 'failed')::int`
      })
      .from(submissions)
      .where(eq(submissions.candidateId, candidateId))

    const recentSubmissions = await db
      .select({
        id: submissions.id,
        assignmentId: assignments.id,
        assignmentTitle: assignments.title,
        joinCode: assignments.joinCode,
        repositoryUrl: submissions.repositoryUrl,
        status: submissions.status,
        createdAt: submissions.createdAt,
        updatedAt: submissions.updatedAt
      })
      .from(submissions)
      .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
      .where(eq(submissions.candidateId, candidateId))
      .orderBy(desc(submissions.createdAt))
      .limit(submissionsLimit)

    return {
      metrics: {
        submissionCount: metrics?.submissionCount ?? 0,
        pendingCount: metrics?.pendingCount ?? 0,
        buildingCount: metrics?.buildingCount ?? 0,
        deployedCount: metrics?.deployedCount ?? 0,
        failedCount: metrics?.failedCount ?? 0
      },
      recentSubmissions
    }
  }
}
