import { Hono } from 'hono'

import { integrationController } from '../controllers/integration.controller.js'
import type { AppBindings } from '../types/hono.js'

export const integrationRoutes = new Hono<AppBindings>()

integrationRoutes.get('/github/app', async (c) => {
  return integrationController.githubAppConfig(c)
})
