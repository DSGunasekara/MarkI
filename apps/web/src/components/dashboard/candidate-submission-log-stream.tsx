import { useEffect, useRef, useState } from "react"
import { useLogStream } from "@/hooks/use-log-stream"
import { candidateApi, toErrorMessage, type PipelineRunStatus } from "@/lib/api"
import { RadioIcon } from "lucide-react"

export function CandidateSubmissionLogStream({
  submissionId,
  runId,
  status
}: {
  submissionId: string
  runId: string
  status: PipelineRunStatus
}) {
  const logEndRef = useRef<HTMLPreElement>(null)
  
  const [pipelineErrorMessage, setPipelineErrorMessage] = useState<string | null>(null)
  const [isLoadingPipeline, setIsLoadingPipeline] = useState(false)
  const [staticLogs, setStaticLogs] = useState<Array<{ stage: string; level: string; message: string; createdAt: string }>>([])
  
  const isPendingBuild = status === "queued" || status === "running"

  const logStream = useLogStream({
    basePath: "/api/candidate/submissions",
    submissionId,
    runId,
    enabled: isPendingBuild
  })

  // Fetch static logs if it's already finished
  useEffect(() => {
    if (!isPendingBuild) {
      setIsLoadingPipeline(true)
      candidateApi.getSubmissionLogs({ submissionId, runId })
        .then((res) => {
          setStaticLogs(res.logs)
        })
        .catch((err) => {
          setPipelineErrorMessage(toErrorMessage(err))
        })
        .finally(() => {
          setIsLoadingPipeline(false)
        })
    }
  }, [isPendingBuild, submissionId, runId])

  useEffect(() => {
    if (logStream.isStreaming && logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight
    }
  }, [logStream.logs.length, logStream.isStreaming])

  if (pipelineErrorMessage) {
    return <p className="text-sm text-destructive px-2 py-4">{pipelineErrorMessage}</p>
  }

  if (logStream.error) {
    return <p className="text-sm text-destructive px-2 py-4">{logStream.error}</p>
  }

  const logsToDisplay = isPendingBuild ? logStream.logs : staticLogs
  const hasLogs = logsToDisplay.length > 0

  return (
    <div className="flex flex-col h-full space-y-3">
      <div className="flex items-center justify-between">
        {logStream.isStreaming ? (
          <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1 mt-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-500">Streaming live</span>
          </div>
        ) : null}
      </div>

      <div className="flex-1 rounded-md border border-border bg-background/60 flex flex-col min-h-[50vh] overflow-hidden">
        {hasLogs ? (
          <pre
            ref={logEndRef}
            className="flex-1 overflow-auto whitespace-pre-wrap p-3 text-xs text-foreground"
          >
            {logsToDisplay
              .map(
                (log) =>
                  `[${new Date(log.createdAt).toLocaleTimeString()}] ${log.stage.toUpperCase()} ${log.level.toUpperCase()} ${log.message}`
              )
              .join("\n")}
          </pre>
        ) : isPendingBuild && logStream.isStreaming ? (
          <p className="text-sm text-muted-foreground p-2">Waiting for build logs...</p>
        ) : isLoadingPipeline ? (
          <p className="text-sm text-muted-foreground p-2">Loading logs...</p>
        ) : (
          <p className="text-sm text-muted-foreground p-2">No logs available for this run yet.</p>
        )}
      </div>

      {logStream.runStatus ? (
        <div className="flex items-center gap-2">
          <RadioIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Run finished with status:{" "}
            <span className="font-medium text-foreground">{logStream.runStatus}</span>
          </span>
        </div>
      ) : null}
    </div>
  )
}
