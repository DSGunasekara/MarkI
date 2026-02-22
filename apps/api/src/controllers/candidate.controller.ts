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
        githubInstallationId: payload.githubInstallationId
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
  }
}
