import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { candidateController } from '../controllers/candidate.controller.js'
import { streamController } from '../controllers/stream.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.middleware.js'
import type { AppBindings } from '../types/hono.js'

const githubRepoUrlRegex = /^https?:\/\/(www\.)?github\.com\/[^/\s]+\/[^/\s]+(?:\.git)?\/?$/i

const createSubmissionSchema = z.object({
  joinCode: z.string().trim().min(4).max(32),
  repositoryUrl: z
    .string()
    .trim()
    .url()
    .max(1024)
    .regex(githubRepoUrlRegex, 'Repository URL must be a GitHub repository link.')
    .optional(),
  repositoryFullName: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/, 'Repository must match owner/repository format.')
    .optional(),
  githubInstallationId: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Installation ID must be numeric.')
    .optional()
}).superRefine((value, ctx) => {
  const hasRepositoryUrl = typeof value.repositoryUrl === 'string' && value.repositoryUrl.length > 0
  const hasRepositorySelection =
    typeof value.repositoryFullName === 'string' &&
    value.repositoryFullName.length > 0

  if (!hasRepositoryUrl && !hasRepositorySelection) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Provide repositoryUrl or repositoryFullName with githubInstallationId.'
    })
  }

  if (
    typeof value.githubInstallationId === 'string' &&
    value.githubInstallationId.length > 0 &&
    !hasRepositorySelection
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'githubInstallationId requires repositoryFullName.'
    })
  }
})

const candidateOverviewQuerySchema = z.object({
  submissionsLimit: z.coerce.number().int().min(1).max(25).optional()
})

const candidateRepositoriesQuerySchema = z.object({
  installationId: z.string().trim().regex(/^\d+$/).optional()
})

const candidateSubmissionParamsSchema = z.object({
  submissionId: z.string().uuid()
})

const candidateSubmissionLogsQuerySchema = z.object({
  runId: z.string().uuid().optional()
})

export const candidateRoutes = new Hono<AppBindings>()

candidateRoutes.post(
  '/submissions',
  requireAuth,
  requireRole(['candidate']),
  zValidator('json', createSubmissionSchema),
  async (c) => {
    const payload = c.req.valid('json')
    return candidateController.createSubmission(c, payload)
  }
)

candidateRoutes.get(
  '/github/repositories',
  requireAuth,
  requireRole(['candidate']),
  zValidator('query', candidateRepositoriesQuerySchema),
  async (c) => {
    const query = c.req.valid('query')
    return candidateController.githubRepositories(c, query)
  }
)

candidateRoutes.get(
  '/overview',
  requireAuth,
  requireRole(['candidate']),
  zValidator('query', candidateOverviewQuerySchema),
  async (c) => {
    const query = c.req.valid('query')
    return candidateController.overview(c, query)
  }
)

candidateRoutes.get(
  '/submissions/:submissionId/logs',
  requireAuth,
  requireRole(['candidate']),
  zValidator('param', candidateSubmissionParamsSchema),
  zValidator('query', candidateSubmissionLogsQuerySchema),
  async (c) => {
    const params = c.req.valid('param')
    const query = c.req.valid('query')
    return candidateController.submissionLogs(c, params, query)
  }
)

candidateRoutes.get(
  '/submissions/:submissionId/logs/stream',
  requireAuth,
  requireRole(['candidate']),
  zValidator('param', candidateSubmissionParamsSchema),
  zValidator('query', candidateSubmissionLogsQuerySchema),
  async (c) => {
    const params = c.req.valid('param')
    const query = c.req.valid('query')
    return streamController.candidateLogStream(c, params, query)
  }
)

const cancelSubmissionRunSchema = z.object({
  runId: z.string().uuid()
})

candidateRoutes.delete(
  '/submissions/:submissionId',
  requireAuth,
  requireRole(['candidate']),
  zValidator('param', candidateSubmissionParamsSchema),
  async (c) => {
    const params = c.req.valid('param')
    return candidateController.deleteSubmission(c, params)
  }
)

candidateRoutes.post(
  '/submissions/:submissionId/cancel',
  requireAuth,
  requireRole(['candidate']),
  zValidator('param', candidateSubmissionParamsSchema),
  zValidator('json', cancelSubmissionRunSchema),
  async (c) => {
    const params = c.req.valid('param')
    const payload = c.req.valid('json')
    return candidateController.cancelSubmissionRun(c, params, payload)
  }
)
