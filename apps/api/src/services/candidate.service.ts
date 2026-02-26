import { assignments, buildRuns, db, submissions, user } from '@hiring-engine/db'
import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm'

import { githubAppService } from './github-app.service.js'
import { pipelineService } from './pipeline.service.js'

type CreateCandidateSubmissionInput = {
  candidateId: string
  joinCode: string
  repositoryUrl?: string
  repositoryFullName?: string
  githubInstallationId?: string
  previewBaseUrl?: string
}

type CandidateOverviewOptions = {
  submissionsLimit: number
}

const DEFAULT_SUBMISSIONS_LIMIT = 12

const getLatestInstallationIdForCandidate = async (
  candidateId: string
): Promise<string | null> => {
  const [record] = await db
    .select({
      githubInstallationId: user.githubInstallationId
    })
    .from(user)
    .where(eq(user.id, candidateId))
    .limit(1)

  return record?.githubInstallationId ?? null
}

export const candidateService = {
  createOrReplaceSubmission: async (input: CreateCandidateSubmissionInput) => {
    const normalizedJoinCode = input.joinCode.trim().toUpperCase()
    const githubAppConfig = githubAppService.getPublicConfig()

    let repositoryFullName = ''
    let canonicalRepositoryUrl = ''
    let repositoryDefaultBranch: string | null = null
    let githubInstallationId: string | null = null

    if (input.repositoryFullName && input.githubInstallationId) {
      const repositoryDetails = await githubAppService.getInstallationRepository(
        input.githubInstallationId,
        input.repositoryFullName
      )

      repositoryFullName = repositoryDetails.repository.fullName
      canonicalRepositoryUrl = repositoryDetails.repository.htmlUrl
      repositoryDefaultBranch = repositoryDetails.repository.defaultBranch
      githubInstallationId = repositoryDetails.installationId
    } else if (input.repositoryFullName) {
      const savedInstallationId = await getLatestInstallationIdForCandidate(input.candidateId)

      if (!savedInstallationId) {
        throw new Error(
          'No saved GitHub App installation found. Install the app and load repositories first.'
        )
      }

      const repositoryDetails = await githubAppService.getInstallationRepository(
        savedInstallationId,
        input.repositoryFullName
      )

      repositoryFullName = repositoryDetails.repository.fullName
      canonicalRepositoryUrl = repositoryDetails.repository.htmlUrl
      repositoryDefaultBranch = repositoryDetails.repository.defaultBranch
      githubInstallationId = repositoryDetails.installationId
    } else if (input.repositoryUrl) {
      const repositoryMetadata = pipelineService.parseGitHubRepositoryMetadata(input.repositoryUrl)
      const integrationMetadata = await githubAppService.resolveRepositoryIntegration(
        repositoryMetadata.repositoryFullName
      )

      if (integrationMetadata.isConfigured && !integrationMetadata.isInstalled) {
        throw new Error(
          'Repository is not connected to the Codr AI GitHub App. Install the app on this repository before submitting.'
        )
      }

      if (githubAppConfig.isConfigured && !integrationMetadata.githubInstallationId) {
        throw new Error(
          'GitHub App is required. Select a repository from your installed repositories.'
        )
      }

      repositoryFullName = repositoryMetadata.repositoryFullName
      canonicalRepositoryUrl = integrationMetadata.repositoryHtmlUrl ?? repositoryMetadata.repositoryHtmlUrl
      repositoryDefaultBranch = integrationMetadata.defaultBranch ?? null
      githubInstallationId = integrationMetadata.githubInstallationId
    } else {
      throw new Error('Repository details are required.')
    }

    if (githubInstallationId) {
      await db.update(user).set({ githubInstallationId }).where(eq(user.id, input.candidateId))
    }

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
          repositoryUrl: canonicalRepositoryUrl,
          repositoryFullName,
          githubInstallationId,
          repositoryDefaultBranch,
          latestCommitSha: null,
          status: 'pending',
          deployedUrl: null,
          lastBuildAt: null,
          updatedAt: new Date()
        })
        .where(eq(submissions.id, existingSubmission.id))
        .returning()

      if (!updatedSubmission) {
        throw new Error('Unable to update existing submission.')
      }

      const queuedRun = await pipelineService.enqueuePipelineRun({
        submissionId: updatedSubmission.id,
        trigger: 'submission',
        previewBaseUrl: input.previewBaseUrl
      })

      return {
        assignment: assignmentRecord,
        submission: updatedSubmission,
        isResubmission: true,
        pipelineRunId: queuedRun.id
      }
    }

    const [createdSubmission] = await db
      .insert(submissions)
      .values({
        assignmentId: assignmentRecord.id,
        candidateId: input.candidateId,
        repositoryUrl: canonicalRepositoryUrl,
        repositoryFullName,
        githubInstallationId,
        repositoryDefaultBranch,
        latestCommitSha: null,
        deployedUrl: null,
        lastBuildAt: null,
        status: 'pending'
      })
      .returning()

    if (!createdSubmission) {
      throw new Error('Unable to create submission.')
    }

    const queuedRun = await pipelineService.enqueuePipelineRun({
      submissionId: createdSubmission.id,
      trigger: 'submission',
      previewBaseUrl: input.previewBaseUrl
    })

    return {
      assignment: assignmentRecord,
      submission: createdSubmission,
      isResubmission: false,
      pipelineRunId: queuedRun.id
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
        deployedUrl: submissions.deployedUrl,
        latestCommitSha: submissions.latestCommitSha,
        lastBuildAt: submissions.lastBuildAt,
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
  },

  getAssignmentByJoinCode: async (joinCode: string) => {
    const normalizedJoinCode = joinCode.trim().toUpperCase()

    const [assignmentRecord] = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        instructions: assignments.instructions,
        joinCode: assignments.joinCode
      })
      .from(assignments)
      .where(eq(assignments.joinCode, normalizedJoinCode))
      .limit(1)

    return assignmentRecord ?? null
  },

  getGitHubRepositories: async (candidateId: string, installationId?: string) => {
    const normalizedInstallationId = installationId?.trim()

    if (normalizedInstallationId && normalizedInstallationId.length > 0) {
      await db.update(user).set({ githubInstallationId: normalizedInstallationId }).where(eq(user.id, candidateId))
    }

    const resolvedInstallationId =
      normalizedInstallationId && normalizedInstallationId.length > 0
        ? normalizedInstallationId
        : await getLatestInstallationIdForCandidate(candidateId)

    if (!resolvedInstallationId) {
      return {
        installationId: null,
        repositories: []
      }
    }

    return githubAppService.listInstallationRepositories(resolvedInstallationId)
  },

  deleteSubmission: async (candidateId: string, submissionId: string): Promise<boolean> => {
    const [submissionRecord] = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(and(eq(submissions.id, submissionId), eq(submissions.candidateId, candidateId)))
      .limit(1)

    if (!submissionRecord) {
      return false
    }

    const activeRuns = await db
      .select({ id: buildRuns.id })
      .from(buildRuns)
      .where(and(eq(buildRuns.submissionId, submissionId), inArray(buildRuns.status, ['queued', 'running'])))

    for (const run of activeRuns) {
      await pipelineService.cancelPipelineRun(run.id)
    }

    await db.delete(submissions).where(eq(submissions.id, submissionId))
    return true
  },

  cancelBuildRun: async (candidateId: string, submissionId: string, runId: string): Promise<boolean> => {
    const [submissionRecord] = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(and(eq(submissions.id, submissionId), eq(submissions.candidateId, candidateId)))
      .limit(1)

    if (!submissionRecord) {
      return false
    }

    return pipelineService.cancelPipelineRun(runId)
  }
}
