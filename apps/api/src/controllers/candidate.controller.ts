import type { Context } from 'hono'

import { candidateService } from '../services/candidate.service.js'
import type { AppBindings } from '../types/hono.js'

type CandidateContext = Context<AppBindings>

type CreateSubmissionPayload = {
  joinCode: string
  repositoryUrl: string
}

type CandidateOverviewQuery = {
  submissionsLimit?: number
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

    const submissionResult = await candidateService.createOrReplaceSubmission({
      candidateId: user.id,
      joinCode: payload.joinCode,
      repositoryUrl: payload.repositoryUrl
    })

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
  }
}
