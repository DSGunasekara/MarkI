import type { Context } from 'hono'

import { githubAppService } from '../services/github-app.service.js'
import type { AppBindings } from '../types/hono.js'

type IntegrationContext = Context<AppBindings>

export const integrationController = {
  githubAppConfig: async (c: IntegrationContext) => {
    return c.json({
      data: githubAppService.getPublicConfig()
    })
  }
}
