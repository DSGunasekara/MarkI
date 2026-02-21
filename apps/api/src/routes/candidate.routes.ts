import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import { candidateController } from '../controllers/candidate.controller.js'
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
    .regex(githubRepoUrlRegex, 'Repository URL must be a public GitHub repository link.')
})

const candidateOverviewQuerySchema = z.object({
  submissionsLimit: z.coerce.number().int().min(1).max(25).optional()
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
  '/overview',
  requireAuth,
  requireRole(['candidate']),
  zValidator('query', candidateOverviewQuerySchema),
  async (c) => {
    const query = c.req.valid('query')
    return candidateController.overview(c, query)
  }
)
