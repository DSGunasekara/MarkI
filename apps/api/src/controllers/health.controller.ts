import type { Context } from 'hono'

import type { AppBindings } from '../types/hono.js'

type HealthContext = Context<AppBindings>

export const healthController = {
  status: (c: HealthContext) => {
    return c.json({
      ok: true,
      service: 'hiring-engine-api'
    })
  }
}
