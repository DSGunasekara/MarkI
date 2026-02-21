import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { auth } from './lib/auth.js'
import { authSessionMiddleware } from './middleware/auth.middleware.js'
import { assignmentRoutes } from './routes/assignment.routes.js'
import { candidateRoutes } from './routes/candidate.routes.js'
import { dashboardRoutes } from './routes/dashboard.routes.js'
import { healthRoutes } from './routes/health.routes.js'
import { integrationRoutes } from './routes/integration.routes.js'
import { sessionRoutes } from './routes/session.routes.js'
import { webhookRoutes } from './routes/webhook.routes.js'
import type { AppBindings } from './types/hono.js'

export const app = new Hono<AppBindings>()

const corsOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0)

app.use(
  '/api/*',
  cors({
    origin: corsOrigins,
    credentials: true
  })
)

app.use('*', authSessionMiddleware)

app.on(['GET', 'POST'], '/api/auth/*', (c) => {
  return auth.handler(c.req.raw)
})

app.route('/api/health', healthRoutes)
app.route('/api/session', sessionRoutes)
app.route('/api/assignments', assignmentRoutes)
app.route('/api/dashboard', dashboardRoutes)
app.route('/api/candidate', candidateRoutes)
app.route('/api/integrations', integrationRoutes)
app.route('/api/webhooks', webhookRoutes)
