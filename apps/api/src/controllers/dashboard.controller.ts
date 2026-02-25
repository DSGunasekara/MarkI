import type { Context } from 'hono'

import { aiReportService } from '../services/ai-report.service.js'
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

type DashboardAssignmentsQuery = {
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

type DashboardSubmissionReportParams = {
  submissionId: string
}

type DashboardSubmissionQuestionPayload = {
  question: string
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

  assignments: async (c: DashboardContext, query: DashboardAssignmentsQuery) => {
    const user = c.get('user')

    if (!user) {
      return c.json(
        {
          message: 'Authentication required.'
        },
        401
      )
    }

    const assignmentsData = await dashboardService.getEmployerAssignments(user.id, {
      search: query.search,
      sort: query.sort,
      limit: query.limit,
      offset: query.offset
    })

    return c.json({
      data: assignmentsData
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
  },

  submissionReport: async (c: DashboardContext, params: DashboardSubmissionReportParams) => {
    const user = c.get('user')

    if (!user) {
      return c.json(
        {
          message: 'Authentication required.'
        },
        401
      )
    }

    const reportView = await aiReportService.getEmployerSubmissionReport(user.id, params.submissionId)
    if (!reportView) {
      return c.json(
        {
          message: 'Submission not found.'
        },
        404
      )
    }

    return c.json({
      data: reportView
    })
  },

  submissionQuestion: async (
    c: DashboardContext,
    params: DashboardSubmissionReportParams,
    payload: DashboardSubmissionQuestionPayload
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

    try {
      const answer = await aiReportService.answerEmployerQuestion({
        employerId: user.id,
        submissionId: params.submissionId,
        question: payload.question
      })

      if (!answer) {
        return c.json(
          {
            message: 'Submission not found.'
          },
          404
        )
      }

      return c.json({
        data: answer
      })
    } catch (error: unknown) {
      return c.json(
        {
          message: error instanceof Error ? error.message : 'Unable to answer question.'
        },
        400
      )
    }
  }
}
