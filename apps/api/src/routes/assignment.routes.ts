import { createAssignmentSchema } from '@hiring-engine/db'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { assignmentController } from '../controllers/assignment.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.middleware.js'
import type { AppBindings } from '../types/hono.js'

export const assignmentRoutes = new Hono<AppBindings>()

assignmentRoutes.post(
  '/',
  requireAuth,
  requireRole(['employer']),
  zValidator('json', createAssignmentSchema),
  async (c) => {
    const payload = c.req.valid('json')
    return assignmentController.create(c, payload)
  }
)
