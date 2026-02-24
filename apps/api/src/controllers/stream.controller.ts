import type { Context } from 'hono'
import { streamSSE } from 'hono/streaming'

import { pipelineService } from '../services/pipeline.service.js'
import { pipelineEvents } from '../services/pipeline-events.js'
import type { AppBindings } from '../types/hono.js'

type StreamContext = Context<AppBindings>

type StreamParams = {
  submissionId: string
}

type StreamQuery = {
  runId?: string
}

/**
 * SSE endpoint for real-time build log streaming.
 *
 * Flow:
 * 1. Resolve the target run (latest or requested)
 * 2. Fetch existing logs from DB
 * 3. Send them as initial events
 * 4. Subscribe to live events and forward them until the run finishes
 */
const streamLogs = (
  c: StreamContext,
  submissionId: string,
  requestedRunId?: string,
  ownerCheck?: {
    type: 'candidate' | 'employer'
    userId: string
  }
) => {
  return streamSSE(c, async (stream) => {
    let resolvedRunId: string | null = null

    if (ownerCheck?.type === 'candidate') {
      const pipeline = await pipelineService.getCandidateSubmissionPipeline(
        ownerCheck.userId,
        submissionId,
        requestedRunId
      )
      resolvedRunId = pipeline?.selectedRun?.id ?? null
    } else if (ownerCheck?.type === 'employer') {
      const pipeline = await pipelineService.getEmployerSubmissionPipeline(
        ownerCheck.userId,
        submissionId,
        requestedRunId
      )
      resolvedRunId = pipeline?.selectedRun?.id ?? null
    }

    if (!resolvedRunId) {
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ message: 'No active run found for this submission.' })
      })
      return
    }

    const pipeline = ownerCheck?.type === 'candidate'
      ? await pipelineService.getCandidateSubmissionPipeline(
          ownerCheck.userId,
          submissionId,
          resolvedRunId
        )
      : await pipelineService.getEmployerSubmissionPipeline(
          ownerCheck!.userId,
          submissionId,
          resolvedRunId
        )

    if (pipeline?.logs) {
      for (const log of pipeline.logs) {
        await stream.writeSSE({
          event: 'log',
          data: JSON.stringify({
            id: log.id,
            stage: log.stage,
            level: log.level,
            message: log.message,
            createdAt: typeof log.createdAt === 'string'
              ? log.createdAt
              : log.createdAt.toISOString()
          })
        })
      }
    }

    const runStatus = pipeline?.selectedRun?.status
    if (runStatus === 'deployed' || runStatus === 'failed') {
      await stream.writeSSE({
        event: 'status',
        data: JSON.stringify({ runId: resolvedRunId, status: runStatus })
      })
      await stream.writeSSE({
        event: 'done',
        data: JSON.stringify({ runId: resolvedRunId })
      })
      return
    }

    const activeRunId = resolvedRunId

    await new Promise<void>((resolve) => {
      const unsubLog = pipelineEvents.onLog(activeRunId, async (event) => {
        try {
          await stream.writeSSE({
            event: 'log',
            data: JSON.stringify(event.log)
          })
        } catch {
          cleanup()
        }
      })

      const unsubStatus = pipelineEvents.onRunStatus(activeRunId, async (event) => {
        try {
          await stream.writeSSE({
            event: 'status',
            data: JSON.stringify({ runId: event.runId, status: event.status })
          })

          if (event.status === 'deployed' || event.status === 'failed') {
            await stream.writeSSE({
              event: 'done',
              data: JSON.stringify({ runId: event.runId })
            })
            cleanup()
          }
        } catch {
          cleanup()
        }
      })

      const cleanup = () => {
        unsubLog()
        unsubStatus()
        resolve()
      }

      stream.onAbort(() => {
        cleanup()
      })
    })
  })
}

export const streamController = {
  candidateLogStream: async (
    c: StreamContext,
    params: StreamParams,
    query: StreamQuery
  ) => {
    const user = c.get('user')

    if (!user) {
      return c.json({ message: 'Authentication required.' }, 401)
    }

    return streamLogs(c, params.submissionId, query.runId, {
      type: 'candidate',
      userId: user.id
    })
  },

  employerLogStream: async (
    c: StreamContext,
    params: StreamParams,
    query: StreamQuery
  ) => {
    const user = c.get('user')

    if (!user) {
      return c.json({ message: 'Authentication required.' }, 401)
    }

    return streamLogs(c, params.submissionId, query.runId, {
      type: 'employer',
      userId: user.id
    })
  }
}
