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
