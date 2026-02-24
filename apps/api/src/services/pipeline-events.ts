import { EventEmitter } from 'node:events'

export type PipelineLogEvent = {
  runId: string
  log: {
    id: string
    stage: string
    level: string
    message: string
    createdAt: string
  }
}

export type PipelineRunStatusEvent = {
  runId: string
  status: 'queued' | 'running' | 'deployed' | 'failed'
}

const emitter = new EventEmitter()
emitter.setMaxListeners(200)

export const pipelineEvents = {
  emitLog(event: PipelineLogEvent): void {
    emitter.emit(`log:${event.runId}`, event)
  },

  emitRunStatus(event: PipelineRunStatusEvent): void {
    emitter.emit(`status:${event.runId}`, event)
  },

  onLog(runId: string, listener: (event: PipelineLogEvent) => void): () => void {
    emitter.on(`log:${runId}`, listener)
    return () => {
      emitter.off(`log:${runId}`, listener)
    }
  },

  onRunStatus(runId: string, listener: (event: PipelineRunStatusEvent) => void): () => void {
    emitter.on(`status:${runId}`, listener)
    return () => {
      emitter.off(`status:${runId}`, listener)
    }
  }
}
