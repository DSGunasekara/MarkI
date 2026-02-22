import { Hono } from 'hono'

import { sessionController } from '../controllers/session.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import type { AppBindings } from '../types/hono.js'

export const sessionRoutes = new Hono<AppBindings>()

sessionRoutes.get('/me', requireAuth, (c) => {
  return sessionController.me(c)
})
