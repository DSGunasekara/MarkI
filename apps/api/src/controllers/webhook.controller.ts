import type { Context } from 'hono'
import { z } from 'zod'

import { githubAppService } from '../services/github-app.service.js'
import { pipelineService } from '../services/pipeline.service.js'
import type { AppBindings } from '../types/hono.js'

type WebhookContext = Context<AppBindings>

const githubPushPayloadSchema = z.object({
  ref: z.string().min(1),
  after: z.string().min(1),
  repository: z.object({
    full_name: z.string().min(1),
    clone_url: z.string().url(),
    default_branch: z.string().min(1).optional().nullable()
  })
})

const toBranchFromRef = (ref: string): string | null => {
  const prefix = 'refs/heads/'
  if (!ref.startsWith(prefix)) {
    return null
  }

  const branch = ref.slice(prefix.length).trim()
  return branch.length > 0 ? branch : null
}

export const webhookController = {
  github: async (c: WebhookContext) => {
    const eventName = c.req.header('x-github-event')
    if (eventName !== 'push') {
      return c.json(
        {
          message: 'Ignored webhook event.'
        },
        202
      )
    }

    const rawBody = await c.req.text()
    const signature = c.req.header('x-hub-signature-256') ?? null

    if (!githubAppService.isValidWebhookSignature(rawBody, signature)) {
      return c.json(
        {
          message: 'Invalid webhook signature.'
        },
        401
      )
    }

    let parsedPayload: unknown
    try {
      parsedPayload = JSON.parse(rawBody)
    } catch {
      return c.json(
        {
          message: 'Invalid JSON payload.'
        },
        400
      )
    }

    const pushPayloadResult = githubPushPayloadSchema.safeParse(parsedPayload)
    if (!pushPayloadResult.success) {
      return c.json(
        {
          message: 'Invalid push payload.'
        },
        400
      )
    }

    const payload = pushPayloadResult.data
    const enqueueResult = await pipelineService.enqueueRunsForGitHubPush({
      repositoryFullName: payload.repository.full_name,
      repositoryDefaultBranch: payload.repository.default_branch ?? null,
      branch: toBranchFromRef(payload.ref),
      commitSha: payload.after
    })

    return c.json(
      {
        data: enqueueResult
      },
      202
    )
  }
}
