import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { candidateApi, toErrorMessage, type PipelineRunStatus } from "@/lib/api"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { CandidateSubmissionLogStream } from "./candidate-submission-log-stream"

type SubmissionBadgeVariant = "default" | "secondary" | "destructive" | "outline"

const statusBadgeVariantMap: Record<PipelineRunStatus, SubmissionBadgeVariant> = {
  queued: "secondary",
  running: "outline",
  deployed: "default",
  failed: "destructive"
}

export function CandidateSubmissionLogs({ submissionId }: { submissionId: string }) {
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [activeRunStatus, setActiveRunStatus] = useState<PipelineRunStatus | null>(null)
  
  const { data: pipelineView, isLoading, error } = useQuery({
    queryKey: ["candidate", "submission", submissionId, "logs"],
    queryFn: () => candidateApi.getSubmissionLogs({ submissionId }),
  })

  const errorMessage = error ? toErrorMessage(error) : null

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-4 md:px-6 lg:px-8">
      <div>
        <h1 className="text-xl font-semibold">Build History</h1>
        <p className="text-sm text-muted-foreground">View your execution logs and pipeline runs.</p>
      </div>

      {errorMessage ? (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="py-3 text-sm text-destructive">{errorMessage}</CardContent>
        </Card>
      ) : null}

      <Card className="app-panel">
        <CardHeader>
          <CardTitle>Pipeline Runs</CardTitle>
          <CardDescription>All build runs triggered for this submission.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading runs...</p>
          ) : pipelineView && pipelineView.runs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Trigger</th>
                    <th className="px-3 py-2 font-medium">Commit</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Started At</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pipelineView.runs.map((run) => (
                    <tr key={run.id} className="border-b border-border/60 align-top">
                      <td className="px-3 py-3 font-medium capitalize">{run.trigger}</td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                        {run.commitSha ? run.commitSha.slice(0, 8) : "-"}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={statusBadgeVariantMap[run.status as PipelineRunStatus] ?? "outline"}>
                          {run.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {run.startedAt ? new Date(run.startedAt).toLocaleString() : "-"}
                      </td>
                      <td className="px-3 py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setActiveRunId(run.id)
                            setActiveRunStatus(run.status as PipelineRunStatus)
                          }}
                        >
                          Check Logs
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No runs found for this submission.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!activeRunId} onOpenChange={(open) => !open && setActiveRunId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Build Logs</DialogTitle>
            <DialogDescription>Showing logs for the selected pipeline run.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden min-h-[50vh]">
            {activeRunId && (
              <CandidateSubmissionLogStream 
                submissionId={submissionId} 
                runId={activeRunId} 
                status={activeRunStatus!} 
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
