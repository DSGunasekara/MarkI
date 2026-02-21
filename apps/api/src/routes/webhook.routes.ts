import { Hono } from 'hono'

import { webhookController } from '../controllers/webhook.controller.js'
import type { AppBindings } from '../types/hono.js'

export const webhookRoutes = new Hono<AppBindings>()

webhookRoutes.post('/github', async (c) => {
  return webhookController.github(c)
})
