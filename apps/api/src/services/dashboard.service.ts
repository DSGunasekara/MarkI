import { assignments, db, submissions } from '@hiring-engine/db'
import { desc, eq, sql } from 'drizzle-orm'

type DashboardOverviewOptions = {
  assignmentsLimit: number
  submissionsLimit: number
}

const DEFAULT_ASSIGNMENTS_LIMIT = 8
const DEFAULT_SUBMISSIONS_LIMIT = 10

export const dashboardService = {
  getEmployerOverview: async (
    employerId: string,
    options?: Partial<DashboardOverviewOptions>
  ) => {
    const assignmentsLimit = options?.assignmentsLimit ?? DEFAULT_ASSIGNMENTS_LIMIT
    const submissionsLimit = options?.submissionsLimit ?? DEFAULT_SUBMISSIONS_LIMIT

    const [metrics] = await db
      .select({
        assignmentCount: sql<number>`count(distinct ${assignments.id})::int`,
        submissionCount: sql<number>`count(${submissions.id})::int`,
        pendingCount: sql<number>`count(*) filter (where ${submissions.status} = 'pending')::int`,
        buildingCount: sql<number>`count(*) filter (where ${submissions.status} = 'building')::int`,
        deployedCount: sql<number>`count(*) filter (where ${submissions.status} = 'deployed')::int`,
        failedCount: sql<number>`count(*) filter (where ${submissions.status} = 'failed')::int`
      })
      .from(assignments)
      .leftJoin(submissions, eq(submissions.assignmentId, assignments.id))
      .where(eq(assignments.employerId, employerId))

    const recentAssignments = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        joinCode: assignments.joinCode,
        createdAt: assignments.createdAt,
        updatedAt: assignments.updatedAt,
        submissionCount: sql<number>`count(${submissions.id})::int`,
        latestSubmissionAt: sql<Date | null>`max(${submissions.createdAt})`
      })
      .from(assignments)
      .leftJoin(submissions, eq(submissions.assignmentId, assignments.id))
      .where(eq(assignments.employerId, employerId))
      .groupBy(assignments.id)
      .orderBy(desc(assignments.createdAt))
      .limit(assignmentsLimit)

    const recentSubmissions = await db
      .select({
        id: submissions.id,
        assignmentId: submissions.assignmentId,
        assignmentTitle: assignments.title,
        candidateId: submissions.candidateId,
        repositoryUrl: submissions.repositoryUrl,
        status: submissions.status,
        createdAt: submissions.createdAt,
        updatedAt: submissions.updatedAt
      })
      .from(submissions)
      .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
      .where(eq(assignments.employerId, employerId))
      .orderBy(desc(submissions.createdAt))
      .limit(submissionsLimit)

    return {
      metrics: {
        assignmentCount: metrics?.assignmentCount ?? 0,
        submissionCount: metrics?.submissionCount ?? 0,
        pendingCount: metrics?.pendingCount ?? 0,
        buildingCount: metrics?.buildingCount ?? 0,
        deployedCount: metrics?.deployedCount ?? 0,
        failedCount: metrics?.failedCount ?? 0
      },
      recentAssignments,
      recentSubmissions
    }
  }
}
