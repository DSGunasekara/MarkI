import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { dashboardController } from '../controllers/dashboard.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.middleware.js'
import type { AppBindings } from '../types/hono.js'

const dashboardOverviewQuerySchema = z.object({
  assignmentsLimit: z.coerce.number().int().min(1).max(25).optional(),
  submissionsLimit: z.coerce.number().int().min(1).max(25).optional()
})

const dashboardSubmissionsQuerySchema = z.object({
  assignmentId: z.string().uuid().optional(),
  status: z.enum(['pending', 'building', 'deployed', 'failed']).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  sort: z.enum(['newest', 'oldest']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(5_000).optional()
})

const dashboardSubmissionParamsSchema = z.object({
  submissionId: z.string().uuid()
})

const dashboardSubmissionLogsQuerySchema = z.object({
  runId: z.string().uuid().optional()
})

const dashboardSubmissionReportParamsSchema = z.object({
  submissionId: z.string().uuid()
})

const dashboardSubmissionQuestionSchema = z.object({
  question: z.string().trim().min(3).max(2000)
})

export const dashboardRoutes = new Hono<AppBindings>()

dashboardRoutes.get(
  '/overview',
  requireAuth,
  requireRole(['employer']),
  zValidator('query', dashboardOverviewQuerySchema),
  async (c) => {
    const query = c.req.valid('query')
    return dashboardController.overview(c, query)
  }
)

dashboardRoutes.get(
  '/submissions',
  requireAuth,
  requireRole(['employer']),
  zValidator('query', dashboardSubmissionsQuerySchema),
  async (c) => {
    const query = c.req.valid('query')
    return dashboardController.submissions(c, query)
  }
)

dashboardRoutes.get(
  '/submissions/:submissionId/logs',
  requireAuth,
  requireRole(['employer']),
  zValidator('param', dashboardSubmissionParamsSchema),
  zValidator('query', dashboardSubmissionLogsQuerySchema),
  async (c) => {
    const params = c.req.valid('param')
    const query = c.req.valid('query')
    return dashboardController.submissionLogs(c, params, query)
  }
)

dashboardRoutes.get(
  '/submissions/:submissionId/ai-report',
  requireAuth,
  requireRole(['employer']),
  zValidator('param', dashboardSubmissionReportParamsSchema),
  async (c) => {
    const params = c.req.valid('param')
    return dashboardController.submissionReport(c, params)
  }
)

dashboardRoutes.post(
  '/submissions/:submissionId/ai-report/questions',
  requireAuth,
  requireRole(['employer']),
  zValidator('param', dashboardSubmissionReportParamsSchema),
  zValidator('json', dashboardSubmissionQuestionSchema),
  async (c) => {
    const params = c.req.valid('param')
    const payload = c.req.valid('json')
    return dashboardController.submissionQuestion(c, params, payload)
  }
)
