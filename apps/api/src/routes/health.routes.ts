import { Hono } from 'hono'

import { healthController } from '../controllers/health.controller.js'
import type { AppBindings } from '../types/hono.js'

export const healthRoutes = new Hono<AppBindings>()

healthRoutes.get('/', (c) => {
  return healthController.status(c)
})
