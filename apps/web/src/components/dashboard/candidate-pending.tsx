import { useCallback, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { RefreshCwIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import {
  candidateApi,
  toErrorMessage,
  type DashboardSubmissionStatus
} from "@/lib/api"

type SubmissionBadgeVariant = "default" | "secondary" | "destructive" | "outline"

const statusBadgeVariantMap: Record<DashboardSubmissionStatus, SubmissionBadgeVariant> = {
  pending: "secondary",
  building: "outline",
  deployed: "default",
  failed: "destructive"
}

const formatDateTime = (value: string): string => {
  return new Date(value).toLocaleString()
}

const toRepositoryHref = (repositoryUrl: string): string => {
  if (repositoryUrl.startsWith("http://") || repositoryUrl.startsWith("https://")) {
    return repositoryUrl
  }

  return `https://${repositoryUrl}`
}

export function CandidatePending() {
  const queryClient = useQueryClient()

  const [activeLogsSubmissionId, setActiveLogsSubmissionId] = useState<string | null>(null)
  const [pipelineErrorMessage, setPipelineErrorMessage] = useState<string | null>(null)
  const [isLoadingPipeline, setIsLoadingPipeline] = useState(false)
  const [pipelineView, setPipelineView] = useState<Awaited<
    ReturnType<typeof candidateApi.getSubmissionLogs>
  > | null>(null)

  const {
    data: overview,
    error,
    isLoading,
    isFetching
  } = useQuery({
    queryKey: ["candidate", "overview"],
    queryFn: () => candidateApi.getOverview({ submissionsLimit: 12 })
  })

  const errorMessage = error ? toErrorMessage(error) : null

  const metrics = useMemo(() => {
    return (
      overview?.metrics ?? {
        submissionCount: 0,
        pendingCount: 0,
        buildingCount: 0,
        deployedCount: 0,
        failedCount: 0
      }
    )
  }, [overview])

  const handleRefresh = () => {
    void queryClient.invalidateQueries({
      queryKey: ["candidate", "overview"]
    })
  }

  const loadSubmissionLogs = useCallback(
    async (submissionId: string, runId?: string) => {
      setIsLoadingPipeline(true)
      setPipelineErrorMessage(null)
      setActiveLogsSubmissionId(submissionId)

      try {
        const response = await candidateApi.getSubmissionLogs({
          submissionId,
          runId
        })
        setPipelineView(response)
      } catch (error: unknown) {
        setPipelineErrorMessage(toErrorMessage(error))
      } finally {
        setIsLoadingPipeline(false)
      }
    },
    []
  )

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-4 md:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Track your submission pipeline and assignment progress.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            <RefreshCwIcon className={isFetching ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </div>
      <section className="space-y-4">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Card className="app-panel">
            <CardContent className="space-y-1 py-4">
              <p className="app-overline">Total submissions</p>
              <p className="text-2xl font-semibold">{metrics.submissionCount}</p>
            </CardContent>
          </Card>
          <Card className="app-panel">
            <CardContent className="space-y-1 py-4">
              <p className="app-overline">Pending</p>
              <p className="text-2xl font-semibold">{metrics.pendingCount}</p>
            </CardContent>
          </Card>
          <Card className="app-panel">
            <CardContent className="space-y-1 py-4">
              <p className="app-overline">Building</p>
              <p className="text-2xl font-semibold">{metrics.buildingCount}</p>
            </CardContent>
          </Card>
          <Card className="app-panel">
            <CardContent className="space-y-1 py-4">
              <p className="app-overline">Deployed</p>
              <p className="text-2xl font-semibold">{metrics.deployedCount}</p>
            </CardContent>
          </Card>
          <Card className="app-panel">
            <CardContent className="space-y-1 py-4">
              <p className="app-overline">Failed</p>
              <p className="text-2xl font-semibold">{metrics.failedCount}</p>
            </CardContent>
          </Card>
        </section>

        {errorMessage ? (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="py-3 text-sm text-destructive">{errorMessage}</CardContent>
          </Card>
        ) : null}

        <Card className="app-panel">
          <CardHeader>
            <CardTitle>My Recent Submissions</CardTitle>
            <CardDescription>Track your assignment submissions and runner status updates.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading submissions...</p>
            ) : overview && overview.recentSubmissions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Assignment</th>
                      <th className="px-3 py-2 font-medium">Join code</th>
                      <th className="px-3 py-2 font-medium">Repository</th>
                      <th className="px-3 py-2 font-medium">Deployment</th>
                      <th className="px-3 py-2 font-medium">Commit</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Updated</th>
                      <th className="px-3 py-2 font-medium">Logs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recentSubmissions.map((submission) => (
                      <tr key={submission.id} className="border-b border-border/60 align-top">
                        <td className="px-3 py-3 font-medium">{submission.assignmentTitle}</td>
                        <td className="px-3 py-3">
                          <Badge variant="outline" className="font-mono tracking-wider">
                            {submission.joinCode}
                          </Badge>
                        </td>
                        <td className="px-3 py-3">
                          <a
                            href={toRepositoryHref(submission.repositoryUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="line-clamp-1 text-foreground underline decoration-border underline-offset-2 hover:text-primary"
                          >
                            {submission.repositoryUrl}
                          </a>
                        </td>
                        <td className="px-3 py-3">
                          {submission.deployedUrl ? (
                            <a
                              href={toRepositoryHref(submission.deployedUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="line-clamp-1 text-foreground underline decoration-border underline-offset-2 hover:text-primary"
                            >
                              Open
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                          {submission.latestCommitSha ? submission.latestCommitSha.slice(0, 8) : "-"}
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant={statusBadgeVariantMap[submission.status]}>{submission.status}</Badge>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{formatDateTime(submission.updatedAt)}</td>
                        <td className="px-3 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              void loadSubmissionLogs(submission.id)
                            }}
                          >
                            View logs
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No submissions yet. Submit your repository to get started.</p>
            )}
          </CardContent>
        </Card>

        {activeLogsSubmissionId ? (
          <Card className="app-panel">
            <CardHeader>
              <CardTitle>Build Logs</CardTitle>
              <CardDescription>
                Inspect build and deployment output for the selected submission.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pipelineErrorMessage ? (
                <p className="text-sm text-destructive">{pipelineErrorMessage}</p>
              ) : null}

              {isLoadingPipeline ? (
                <p className="text-sm text-muted-foreground">Loading pipeline logs...</p>
              ) : pipelineView ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    {pipelineView.runs.map((run) => (
                      <Button
                        key={run.id}
                        size="sm"
                        variant={pipelineView.selectedRun?.id === run.id ? "secondary" : "outline"}
                        onClick={() => {
                          void loadSubmissionLogs(activeLogsSubmissionId, run.id)
                        }}
                      >
                        {run.trigger}:{run.status}
                      </Button>
                    ))}
                  </div>

                  <div className="rounded-md border border-border bg-background/60 p-3">
                    <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs text-foreground">
                      {pipelineView.logs.length > 0
                        ? pipelineView.logs
                            .map((log) => `[${new Date(log.createdAt).toLocaleTimeString()}] ${log.stage.toUpperCase()} ${log.level.toUpperCase()} ${log.message}`)
                            .join("\n")
                        : "No logs available for this run yet."}
                    </pre>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No pipeline data available.</p>
              )}
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  )
}
