import type { Context } from 'hono'

import { dashboardService } from '../services/dashboard.service.js'
import { pipelineService } from '../services/pipeline.service.js'
import type { AppBindings } from '../types/hono.js'

type DashboardContext = Context<AppBindings>

type DashboardOverviewQuery = {
  assignmentsLimit?: number
  submissionsLimit?: number
}

type DashboardSubmissionsQuery = {
  assignmentId?: string
  status?: 'pending' | 'building' | 'deployed' | 'failed'
  search?: string
  sort?: 'newest' | 'oldest'
  limit?: number
  offset?: number
}

type DashboardSubmissionLogsParams = {
  submissionId: string
}

type DashboardSubmissionLogsQuery = {
  runId?: string
}

export const dashboardController = {
  overview: async (c: DashboardContext, query: DashboardOverviewQuery) => {
    const user = c.get('user')

    if (!user) {
      return c.json(
        {
          message: 'Authentication required.'
        },
        401
      )
    }

    const dashboardData = await dashboardService.getEmployerOverview(user.id, {
      assignmentsLimit: query.assignmentsLimit,
      submissionsLimit: query.submissionsLimit
    })

    return c.json({
      data: dashboardData
    })
  },

  submissions: async (c: DashboardContext, query: DashboardSubmissionsQuery) => {
    const user = c.get('user')

    if (!user) {
      return c.json(
        {
          message: 'Authentication required.'
        },
        401
      )
    }

    const submissionsData = await dashboardService.getEmployerSubmissions(user.id, {
      assignmentId: query.assignmentId,
      status: query.status,
      search: query.search,
      sort: query.sort,
      limit: query.limit,
      offset: query.offset
    })

    return c.json({
      data: submissionsData
    })
  },

  submissionLogs: async (
    c: DashboardContext,
    params: DashboardSubmissionLogsParams,
    query: DashboardSubmissionLogsQuery
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

    const pipelineView = await pipelineService.getEmployerSubmissionPipeline(
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
