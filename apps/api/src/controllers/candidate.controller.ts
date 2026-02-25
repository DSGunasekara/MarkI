import type { Context } from 'hono'

import { GitHubApiError } from '../services/github-app.service.js'
import { candidateService } from '../services/candidate.service.js'
import { pipelineService } from '../services/pipeline.service.js'
import type { AppBindings } from '../types/hono.js'

type CandidateContext = Context<AppBindings>

type CreateSubmissionPayload = {
  joinCode: string
  repositoryUrl?: string
  repositoryFullName?: string
  githubInstallationId?: string
}

type CandidateOverviewQuery = {
  submissionsLimit?: number
}

type CandidateRepositoriesQuery = {
  installationId?: string
}

type CandidateSubmissionLogsParams = {
  submissionId: string
}

type CandidateSubmissionLogsQuery = {
  runId?: string
}

type CandidateAssignmentParams = {
  joinCode: string
}

const toFirstHeaderValue = (value?: string): string | null => {
  if (!value) {
    return null
  }

  const [firstValue] = value.split(',')
  const normalizedValue = firstValue?.trim()
  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : null
}

const resolveRequestOrigin = (c: CandidateContext): string | null => {
  const originHeader = toFirstHeaderValue(c.req.header('origin'))
  if (originHeader) {
    try {
      return new URL(originHeader).origin
    } catch {
      // Ignore invalid user-provided origin header and fall back.
    }
  }

  const forwardedHost = toFirstHeaderValue(c.req.header('x-forwarded-host'))
  const forwardedProto = toFirstHeaderValue(c.req.header('x-forwarded-proto'))
  const normalizedForwardedProto = forwardedProto?.toLowerCase().replace(/:$/, '')

  if (
    forwardedHost &&
    (normalizedForwardedProto === 'http' || normalizedForwardedProto === 'https')
  ) {
    return `${normalizedForwardedProto}://${forwardedHost}`
  }

  try {
    return new URL(c.req.url).origin
  } catch {
    return null
  }
}

export const candidateController = {
  createSubmission: async (c: CandidateContext, payload: CreateSubmissionPayload) => {
    const user = c.get('user')

    if (!user) {
      return c.json(
        {
          message: 'Authentication required.'
        },
        401
      )
    }

    let submissionResult: Awaited<ReturnType<typeof candidateService.createOrReplaceSubmission>>
    try {
      submissionResult = await candidateService.createOrReplaceSubmission({
        candidateId: user.id,
        joinCode: payload.joinCode,
        repositoryUrl: payload.repositoryUrl,
        repositoryFullName: payload.repositoryFullName,
        githubInstallationId: payload.githubInstallationId,
        previewBaseUrl: resolveRequestOrigin(c) ?? undefined
      })
    } catch (error: unknown) {
      if (error instanceof GitHubApiError) {
        return c.json(
          {
            message:
              'Unable to validate repository against GitHub App. Verify app credentials and repository access.'
          },
          502
        )
      }

      if (error instanceof Error) {
        return c.json(
          {
            message: error.message
          },
          400
        )
      }

      return c.json(
        {
          message: 'Unable to create submission.'
        },
        400
      )
    }

    if (!submissionResult) {
      return c.json(
        {
          message: 'No assignment found for the provided join code.'
        },
        404
      )
    }

    return c.json(
      {
        data: submissionResult
      },
      201
    )
  },

  getAssignmentByJoinCode: async (c: CandidateContext, params: CandidateAssignmentParams) => {
    const user = c.get('user')

    if (!user) {
      return c.json(
        {
          message: 'Authentication required.'
        },
        401
      )
    }

    const assignment = await candidateService.getAssignmentByJoinCode(params.joinCode)

    if (!assignment) {
      return c.json(
        {
          message: 'Assignment not found.'
        },
        404
      )
    }

    return c.json({
      data: assignment
    })
  },

  overview: async (c: CandidateContext, query: CandidateOverviewQuery) => {
    const user = c.get('user')

    if (!user) {
      return c.json(
        {
          message: 'Authentication required.'
        },
        401
      )
    }

    const overview = await candidateService.getOverview(user.id, {
      submissionsLimit: query.submissionsLimit
    })

    return c.json({
      data: overview
    })
  },

  githubRepositories: async (c: CandidateContext, query: CandidateRepositoriesQuery) => {
    const user = c.get('user')

    if (!user) {
      return c.json(
        {
          message: 'Authentication required.'
        },
        401
      )
    }

    try {
      const repositories = await candidateService.getGitHubRepositories(
        user.id,
        query.installationId
      )

      return c.json({
        data: repositories
      })
    } catch (error: unknown) {
      if (error instanceof GitHubApiError) {
        return c.json(
          {
            message:
              'Unable to list repositories for this installation. Confirm app installation and permissions.'
          },
          502
        )
      }

      if (error instanceof Error) {
        return c.json(
          {
            message: error.message
          },
          400
        )
      }

      return c.json(
        {
          message: 'Unable to list repositories.'
        },
        400
      )
    }
  },

  submissionLogs: async (
    c: CandidateContext,
    params: CandidateSubmissionLogsParams,
    query: CandidateSubmissionLogsQuery
  ) => {
    const user = c.get('user')

    if (!user) {
      return c.json(
        {
          message: 'Authentication required.'
        },
        401
      )
    }

    const pipelineView = await pipelineService.getCandidateSubmissionPipeline(
      user.id,
      params.submissionId,
      query.runId
    )

    if (!pipelineView) {
      return c.json(
        {
          message: 'Submission not found.'
        },
        404
      )
    }

    return c.json({
      data: pipelineView
    })
  },

  deleteSubmission: async (c: CandidateContext, params: CandidateSubmissionLogsParams) => {
    const user = c.get('user')

    if (!user) {
      return c.json({ message: 'Authentication required.' }, 401)
    }

    const deleted = await candidateService.deleteSubmission(user.id, params.submissionId)

    if (!deleted) {
      return c.json({ message: 'Submission not found or unauthorized.' }, 404)
    }

    return c.json({ message: 'Submission deleted.' })
  },

  cancelSubmissionRun: async (c: CandidateContext, params: CandidateSubmissionLogsParams, payload: { runId: string }) => {
    const user = c.get('user')

    if (!user) {
      return c.json({ message: 'Authentication required.' }, 401)
    }

    const canceled = await candidateService.cancelBuildRun(user.id, params.submissionId, payload.runId)

    if (!canceled) {
      return c.json({ message: 'Run not found or already completed.' }, 400)
    }

    return c.json({ message: 'Run canceled.' })
  }
}
