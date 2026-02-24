import { useCallback, useEffect, useRef, useState } from "react"

import type { SubmissionPipelineLog } from "@/lib/api"

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ""

type LogStreamState = {
  logs: SubmissionPipelineLog[]
  isStreaming: boolean
  runStatus: string | null
  error: string | null
}

type UseLogStreamOptions = {
  /** The base path for the SSE endpoint, e.g. `/api/candidate/submissions` or `/api/dashboard/submissions` */
  basePath: string
  /** The submission ID */
  submissionId: string | null
  /** Optional run ID to stream a specific run */
  runId?: string | null
  /** Whether streaming is enabled (set to true when user opens logs for a building submission) */
  enabled: boolean
}

const resolveUrl = (path: string): string => {
  if (!apiBaseUrl) {
    return path
  }
  return new URL(path, apiBaseUrl).toString()
}

export function useLogStream({
  basePath,
  submissionId,
  runId,
  enabled
}: UseLogStreamOptions): LogStreamState & { resetStream: () => void } {
  const [state, setState] = useState<LogStreamState>({
    logs: [],
    isStreaming: false,
    runStatus: null,
    error: null
  })

  const eventSourceRef = useRef<EventSource | null>(null)
  const seenLogIdsRef = useRef<Set<string>>(new Set())

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setState((current) => ({
      ...current,
      isStreaming: false
    }))
  }, [])

  const resetStream = useCallback(() => {
    cleanup()
    seenLogIdsRef.current.clear()
    setState({
      logs: [],
      isStreaming: false,
      runStatus: null,
      error: null
    })
  }, [cleanup])

  useEffect(() => {
    if (!enabled || !submissionId) {
      cleanup()
      return
    }

    cleanup()
    seenLogIdsRef.current.clear()

    const query = new URLSearchParams()
    if (runId) {
      query.set("runId", runId)
    }

    const queryString = query.toString()
    const streamPath = `${basePath}/${submissionId}/logs/stream${queryString ? `?${queryString}` : ""}`
    const resolvedUrl = resolveUrl(streamPath)

    const eventSource = new EventSource(resolvedUrl, {
      withCredentials: true
    })

    eventSourceRef.current = eventSource

    setState({
      logs: [],
      isStreaming: true,
      runStatus: null,
      error: null
    })

    eventSource.addEventListener("log", (event) => {
      try {
        const log = JSON.parse(event.data) as SubmissionPipelineLog

        if (seenLogIdsRef.current.has(log.id)) {
          return
        }

        seenLogIdsRef.current.add(log.id)

        setState((current) => ({
          ...current,
          logs: [...current.logs, log]
        }))
      } catch {
        // Ignore malformed log events
      }
    })

    eventSource.addEventListener("status", (event) => {
      try {
        const data = JSON.parse(event.data) as { runId: string; status: string }

        setState((current) => ({
          ...current,
          runStatus: data.status
        }))
      } catch {
        // Ignore malformed status events
      }
    })

    eventSource.addEventListener("done", () => {
      setState((current) => ({
        ...current,
        isStreaming: false
      }))
      eventSource.close()
    })

    eventSource.addEventListener("error", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as { message: string }
        setState((current) => ({
          ...current,
          error: data.message,
          isStreaming: false
        }))
      } catch {
        // SSE connection error (not a custom error event)
        setState((current) => ({
          ...current,
          isStreaming: false
        }))
      }
      eventSource.close()
    })

    eventSource.onerror = () => {
      setState((current) => ({
        ...current,
        isStreaming: false
      }))
      eventSource.close()
    }

    return () => {
      eventSource.close()
      eventSourceRef.current = null
    }
  }, [enabled, submissionId, runId, basePath, cleanup])

  return {
    ...state,
    resetStream
  }
}
