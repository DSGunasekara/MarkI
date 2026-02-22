import { assignments, db, submissions, user } from '@hiring-engine/db'
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

type DashboardOverviewOptions = {
  assignmentsLimit: number
  submissionsLimit: number
}

type DashboardSubmissionsOptions = {
  assignmentId?: string
  status?: 'pending' | 'building' | 'deployed' | 'failed'
  search?: string
  sort: 'newest' | 'oldest'
  limit: number
  offset: number
}

const DEFAULT_ASSIGNMENTS_LIMIT = 8
const DEFAULT_SUBMISSIONS_LIMIT = 10
const DEFAULT_EXPLORER_LIMIT = 25

const candidateUser = alias(user, 'candidate_user')

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
        deployedUrl: submissions.deployedUrl,
        latestCommitSha: submissions.latestCommitSha,
        lastBuildAt: submissions.lastBuildAt,
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
  },

  getEmployerSubmissions: async (
    employerId: string,
    options?: Partial<DashboardSubmissionsOptions>
  ) => {
    const assignmentId = options?.assignmentId
    const status = options?.status
    const search = options?.search?.trim()
    const sort = options?.sort ?? 'newest'
    const limit = options?.limit ?? DEFAULT_EXPLORER_LIMIT
    const offset = options?.offset ?? 0

    const assignmentOptions = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        joinCode: assignments.joinCode,
        submissionCount: sql<number>`count(${submissions.id})::int`,
        latestSubmissionAt: sql<Date | null>`max(${submissions.createdAt})`
      })
      .from(assignments)
      .leftJoin(submissions, eq(submissions.assignmentId, assignments.id))
      .where(eq(assignments.employerId, employerId))
      .groupBy(assignments.id)
      .orderBy(desc(assignments.createdAt))

    const conditions = [eq(assignments.employerId, employerId)]

    if (assignmentId) {
      conditions.push(eq(submissions.assignmentId, assignmentId))
    }

    if (status) {
      conditions.push(eq(submissions.status, status))
    }

    if (search && search.length > 0) {
      conditions.push(
        or(
          ilike(assignments.title, `%${search}%`),
          ilike(assignments.joinCode, `%${search}%`),
          ilike(submissions.repositoryUrl, `%${search}%`),
          ilike(candidateUser.email, `%${search}%`),
          ilike(candidateUser.name, `%${search}%`)
        )!
      )
    }

    const whereClause = and(...conditions)
    const orderBy = sort === 'oldest' ? asc(submissions.createdAt) : desc(submissions.createdAt)

    const [totalResult] = await db
      .select({
        totalSubmissions: sql<number>`count(*)::int`
      })
      .from(submissions)
      .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
      .innerJoin(candidateUser, eq(submissions.candidateId, candidateUser.id))
      .where(whereClause)

    const filteredSubmissions = await db
      .select({
        id: submissions.id,
        assignmentId: assignments.id,
        assignmentTitle: assignments.title,
        joinCode: assignments.joinCode,
        candidateId: submissions.candidateId,
        candidateName: candidateUser.name,
        candidateEmail: candidateUser.email,
        repositoryUrl: submissions.repositoryUrl,
        deployedUrl: submissions.deployedUrl,
        latestCommitSha: submissions.latestCommitSha,
        lastBuildAt: submissions.lastBuildAt,
        status: submissions.status,
        createdAt: submissions.createdAt,
        updatedAt: submissions.updatedAt
      })
      .from(submissions)
      .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
      .innerJoin(candidateUser, eq(submissions.candidateId, candidateUser.id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset)

    return {
      filters: {
        assignmentId: assignmentId ?? null,
        status: status ?? null,
        search: search ?? null,
        sort,
        limit,
        offset
      },
      assignmentOptions,
      totalSubmissions: totalResult?.totalSubmissions ?? 0,
      submissions: filteredSubmissions
    }
  }
}
