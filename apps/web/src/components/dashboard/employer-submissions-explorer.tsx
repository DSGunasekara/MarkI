import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RadioIcon,
  RefreshCwIcon,
  SparklesIcon,
  FileTextIcon,
  ArrowRightIcon,
  BrainCircuitIcon,
  CodeIcon,
  AlertTriangleIcon,
  MessageSquareIcon,
  CheckCircle2Icon
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  dashboardApi,
  toErrorMessage,
  type AiReportStatus,
  type DashboardSubmissionStatus,
  type EmployerSubmissionAiReportView,
  type EmployerSubmissionExplorer,
  type EmployerSubmissionsSort
} from "@/lib/api"
import { useLogStream } from "@/hooks/use-log-stream"

type EmployerSubmissionsExplorerProps = {
  initialAssignmentId?: string | null
}

type ExplorerFilterDraft = {
  assignmentId: string
  status: "all" | DashboardSubmissionStatus
  search: string
  sort: EmployerSubmissionsSort
}

type SubmissionBadgeVariant = "default" | "secondary" | "destructive" | "outline"

const DEFAULT_LIMIT = 30

const DEFAULT_FILTERS: ExplorerFilterDraft = {
  assignmentId: "all",
  status: "all",
  search: "",
  sort: "newest"
}

const statusBadgeVariantMap: Record<DashboardSubmissionStatus, SubmissionBadgeVariant> = {
  pending: "secondary",
  building: "outline",
  deployed: "default",
  failed: "destructive"
}

const aiReportStatusBadgeVariantMap: Record<AiReportStatus, SubmissionBadgeVariant> = {
  pending: "outline",
  completed: "default",
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

export function EmployerSubmissionsExplorer({
  initialAssignmentId
}: EmployerSubmissionsExplorerProps) {
  const queryClient = useQueryClient()

  const [draftFilters, setDraftFilters] = useState<ExplorerFilterDraft>(DEFAULT_FILTERS)
  const [activeFilters, setActiveFilters] = useState<ExplorerFilterDraft>(DEFAULT_FILTERS)
  const [offset, setOffset] = useState(0)

  const [activeLogsSubmissionId, setActiveLogsSubmissionId] = useState<string | null>(null)
  const [activeLogsSubmissionStatus, setActiveLogsSubmissionStatus] = useState<DashboardSubmissionStatus | null>(null)
  const [pipelineErrorMessage, setPipelineErrorMessage] = useState<string | null>(null)
  const [isLoadingPipeline, setIsLoadingPipeline] = useState(false)
  const [pipelineView, setPipelineView] = useState<Awaited<
    ReturnType<typeof dashboardApi.getSubmissionLogs>
  > | null>(null)
  const [activeStreamRunId, setActiveStreamRunId] = useState<string | null>(null)
  const [activeAiSubmissionId, setActiveAiSubmissionId] = useState<string | null>(null)
  const [aiReportErrorMessage, setAiReportErrorMessage] = useState<string | null>(null)
  const [isLoadingAiReport, setIsLoadingAiReport] = useState(false)
  const [isAskingAiQuestion, setIsAskingAiQuestion] = useState(false)
  const [aiQuestionDraft, setAiQuestionDraft] = useState("")
  const [aiReportView, setAiReportView] = useState<EmployerSubmissionAiReportView | null>(null)

  const logEndRef = useRef<HTMLPreElement>(null)

  const shouldStream = activeLogsSubmissionId !== null &&
    (activeLogsSubmissionStatus === "building" || activeLogsSubmissionStatus === "pending")

  const logStream = useLogStream({
    basePath: "/api/dashboard/submissions",
    submissionId: activeLogsSubmissionId,
    runId: activeStreamRunId,
    enabled: shouldStream
  })

  // Auto-scroll when streaming new logs
  useEffect(() => {
    if (logStream.isStreaming && logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight
    }
  }, [logStream.logs.length, logStream.isStreaming])

  // When stream finishes, refresh submissions to update statuses
  useEffect(() => {
    if (logStream.runStatus === "deployed" || logStream.runStatus === "failed") {
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "submissions"] })
    }
  }, [logStream.runStatus, queryClient])

  const queryParams = useMemo(
    () => ({
      assignmentId: activeFilters.assignmentId,
      status: activeFilters.status,
      search: activeFilters.search,
      sort: activeFilters.sort,
      offset
    }),
    [activeFilters, offset]
  )

  const {
    data: explorerData,
    error,
    isLoading,
    isFetching
  } = useQuery({
    queryKey: ["dashboard", "submissions", queryParams],
    queryFn: () =>
      dashboardApi.getSubmissions({
        assignmentId: activeFilters.assignmentId === "all" ? undefined : activeFilters.assignmentId,
        status: activeFilters.status === "all" ? undefined : activeFilters.status,
        search: activeFilters.search,
        sort: activeFilters.sort,
        limit: DEFAULT_LIMIT,
        offset
      })
  })

  const errorMessage = error ? toErrorMessage(error) : null

  useEffect(() => {
    const nextAssignmentId = initialAssignmentId ?? "all"

    if (activeFilters.assignmentId === nextAssignmentId) {
      return
    }

    setOffset(0)
    setDraftFilters((current) => ({
      ...current,
      assignmentId: nextAssignmentId
    }))
    setActiveFilters((current) => ({
      ...current,
      assignmentId: nextAssignmentId
    }))
  }, [activeFilters.assignmentId, initialAssignmentId])

  const groupedSubmissions = useMemo(() => {
    if (!explorerData) {
      return []
    }

    const groupedMap = new Map<
      string,
      {
        assignmentId: string
        assignmentTitle: string
        joinCode: string
        submissions: EmployerSubmissionExplorer["submissions"]
      }
    >()

    for (const submission of explorerData.submissions) {
      const existingGroup = groupedMap.get(submission.assignmentId)

      if (!existingGroup) {
        groupedMap.set(submission.assignmentId, {
          assignmentId: submission.assignmentId,
          assignmentTitle: submission.assignmentTitle,
          joinCode: submission.joinCode,
          submissions: [submission]
        })
        continue
      }

      existingGroup.submissions.push(submission)
    }

    return Array.from(groupedMap.values())
  }, [explorerData])

  const hasNextPage = useMemo(() => {
    if (!explorerData) {
      return false
    }

    return offset + explorerData.submissions.length < explorerData.totalSubmissions
  }, [explorerData, offset])

  const canAskAiQuestion = aiReportView?.report?.status === "completed"

  const handleApplyFilters = () => {
    setOffset(0)
    setActiveFilters(draftFilters)
  }

  const handleClearFilters = () => {
    setOffset(0)
    setDraftFilters(DEFAULT_FILTERS)
    setActiveFilters(DEFAULT_FILTERS)
  }

  const handleRefresh = () => {
    void queryClient.invalidateQueries({
      queryKey: ["dashboard", "submissions"]
    })
  }

  const loadSubmissionLogs = useCallback(
    async (submissionId: string, status: DashboardSubmissionStatus, runId?: string) => {
      setActiveLogsSubmissionId(submissionId)
      setActiveLogsSubmissionStatus(status)
      setActiveStreamRunId(runId ?? null)

      if (status === "building" || status === "pending") {
        logStream.resetStream()
        setPipelineView(null)
        setPipelineErrorMessage(null)
        setIsLoadingPipeline(false)
        return
      }

      setIsLoadingPipeline(true)
      setPipelineErrorMessage(null)

      try {
        const response = await dashboardApi.getSubmissionLogs({
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
    [logStream]
  )

  const loadSubmissionAiReport = useCallback(async (submissionId: string) => {
    setActiveAiSubmissionId(submissionId)
    setIsLoadingAiReport(true)
    setAiReportErrorMessage(null)

    try {
      const response = await dashboardApi.getSubmissionAiReport(submissionId)
      setAiReportView(response)
    } catch (error: unknown) {
      setAiReportErrorMessage(toErrorMessage(error))
      setAiReportView(null)
    } finally {
      setIsLoadingAiReport(false)
    }
  }, [])

  const handleAskAiQuestion = useCallback(async () => {
    const question = aiQuestionDraft.trim()
    if (!activeAiSubmissionId || question.length === 0) {
      return
    }

    setIsAskingAiQuestion(true)
    setAiReportErrorMessage(null)

    try {
      await dashboardApi.askSubmissionAiQuestion({
        submissionId: activeAiSubmissionId,
        question
      })
      setAiQuestionDraft("")
      const refreshed = await dashboardApi.getSubmissionAiReport(activeAiSubmissionId)
      setAiReportView(refreshed)
    } catch (error: unknown) {
      setAiReportErrorMessage(toErrorMessage(error))
    } finally {
      setIsAskingAiQuestion(false)
    }
  }, [activeAiSubmissionId, aiQuestionDraft])

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-4 md:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Submissions Explorer</h1>
          <p className="text-sm text-muted-foreground">Filter and inspect submissions grouped by assignment.</p>
        </div>
      </div>
      <section className="space-y-4">
        <Card className="app-panel">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Filter by assignment, status, and search terms to quickly narrow employer submissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="explorer-assignment" className="app-overline">
                Assignment
              </Label>
              <Select
                value={draftFilters.assignmentId}
                onValueChange={(value) => {
                  setDraftFilters((current) => ({
                    ...current,
                    assignmentId: value
                  }))
                }}
              >
                <SelectTrigger id="explorer-assignment" className="h-10 w-full border-input bg-background">
                  <SelectValue placeholder="All assignments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All assignments</SelectItem>
                    {explorerData?.assignmentOptions.map((assignmentOption) => (
                      <SelectItem key={assignmentOption.id} value={assignmentOption.id}>
                        {assignmentOption.title}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="explorer-status" className="app-overline">
                Status
              </Label>
              <Select
                value={draftFilters.status}
                onValueChange={(value) => {
                  setDraftFilters((current) => ({
                    ...current,
                    status: value as ExplorerFilterDraft["status"]
                  }))
                }}
              >
                <SelectTrigger id="explorer-status" className="h-10 w-full border-input bg-background">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">pending</SelectItem>
                    <SelectItem value="building">building</SelectItem>
                    <SelectItem value="deployed">deployed</SelectItem>
                    <SelectItem value="failed">failed</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 xl:col-span-2">
              <Label htmlFor="explorer-search" className="app-overline">
                Search
              </Label>
              <Input
                id="explorer-search"
                value={draftFilters.search}
                onChange={(event) => {
                  setDraftFilters((current) => ({
                    ...current,
                    search: event.target.value
                  }))
                }}
                className="h-10 border-input bg-background"
                placeholder="Assignment, join code, candidate email, or repo URL"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="explorer-sort" className="app-overline">
                Sort
              </Label>
              <Select
                value={draftFilters.sort}
                onValueChange={(value) => {
                  setDraftFilters((current) => ({
                    ...current,
                    sort: value as EmployerSubmissionsSort
                  }))
                }}
              >
                <SelectTrigger id="explorer-sort" className="h-10 w-full border-input bg-background">
                  <SelectValue placeholder="Sort order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="newest">Newest first</SelectItem>
                    <SelectItem value="oldest">Oldest first</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {explorerData ? `${explorerData.totalSubmissions} matching submissions` : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                Clear
              </Button>
              <Button size="sm" onClick={handleApplyFilters}>
                Apply filters
              </Button>
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
          </CardFooter>
        </Card>

        {errorMessage ? (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="py-3 text-sm text-destructive">{errorMessage}</CardContent>
          </Card>
        ) : null}

        {isLoading ? (
          <Card className="app-panel">
            <CardContent className="py-6 text-sm text-muted-foreground">Loading submissions...</CardContent>
          </Card>
        ) : groupedSubmissions.length > 0 ? (
          <div className="space-y-3">
            {groupedSubmissions.map((group) => (
              <Card className="app-panel" key={group.assignmentId}>
                <CardHeader>
                  <CardTitle>{group.assignmentTitle}</CardTitle>
                  <CardDescription>
                    Join code <span className="font-mono">{group.joinCode}</span> · {group.submissions.length} submissions in current results
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Candidate</th>
                          <th className="px-3 py-2 font-medium">Repository</th>
                          <th className="px-3 py-2 font-medium">Deployment</th>
                          <th className="px-3 py-2 font-medium">Commit</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 font-medium">Created</th>
                          <th className="px-3 py-2 font-medium">Updated</th>
                          <th className="px-3 py-2 font-medium">Logs</th>
                          <th className="px-3 py-2 font-medium">AI report</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.submissions.map((submission) => (
                          <tr key={submission.id} className="border-b border-border/60 align-top">
                            <td className="px-3 py-3">
                              <p className="font-medium">{submission.candidateName}</p>
                              <p className="text-xs text-muted-foreground">{submission.candidateEmail}</p>
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
                            <td className="px-3 py-3 text-muted-foreground">{formatDateTime(submission.createdAt)}</td>
                            <td className="px-3 py-3 text-muted-foreground">{formatDateTime(submission.updatedAt)}</td>
                            <td className="px-3 py-3">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  void loadSubmissionLogs(submission.id, submission.status)
                                }}
                              >
                                View logs
                              </Button>
                            </td>
                            <td className="px-3 py-3">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  void loadSubmissionAiReport(submission.id)
                                }}
                              >
                                <SparklesIcon />
                                View report
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="app-panel">
            <CardContent className="py-6 text-sm text-muted-foreground">
              No submissions match the current filters.
            </CardContent>
          </Card>
        )}

        <Card className="app-panel">
          <CardContent className="flex items-center justify-between gap-3 py-3">
            <p className="text-sm text-muted-foreground">
              Showing {explorerData?.submissions.length ?? 0} of {explorerData?.totalSubmissions ?? 0}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => {
                  setOffset((current) => Math.max(current - DEFAULT_LIMIT, 0))
                }}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNextPage}
                onClick={() => {
                  setOffset((current) => current + DEFAULT_LIMIT)
                }}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <Dialog open={!!activeLogsSubmissionId} onOpenChange={(open) => !open && setActiveLogsSubmissionId(null)}>
        <DialogContent className="sm:max-w-[95vw] lg:max-w-6xl w-[95vw] h-[95vh] sm:h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Pipeline Logs</DialogTitle>
                <DialogDescription>
                  Review build and deployment output for the selected submission.
                </DialogDescription>
              </div>
              {logStream.isStreaming ? (
                <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-xs font-medium text-emerald-500">Streaming live</span>
                </div>
              ) : null}
            </div>
          </DialogHeader>
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto space-y-3 px-1 pb-4">
              {pipelineErrorMessage ? (
                <p className="text-sm text-destructive">{pipelineErrorMessage}</p>
              ) : null}

              {logStream.error ? (
                <p className="text-sm text-destructive">{logStream.error}</p>
              ) : null}

              {shouldStream ? (
                <>
                  {logStream.logs.length > 0 ? (
                    <div className="rounded-md border border-border bg-background/60 flex-1 min-h-0 flex flex-col overflow-hidden">
                      <pre
                        ref={logEndRef}
                        className="flex-1 overflow-auto whitespace-pre-wrap p-3 text-xs text-foreground"
                      >
                        {logStream.logs
                          .map((log) => `[${new Date(log.createdAt).toLocaleTimeString()}] ${log.stage.toUpperCase()} ${log.level.toUpperCase()} ${log.message}`)
                          .join("\n")}
                      </pre>
                    </div>
                  ) : logStream.isStreaming ? (
                    <p className="text-sm text-muted-foreground">Waiting for build logs...</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No logs available for this run yet.</p>
                  )}

                  {logStream.runStatus ? (
                    <div className="flex items-center gap-2">
                      <RadioIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Run finished with status: <span className="font-medium text-foreground">{logStream.runStatus}</span>
                      </span>
                    </div>
                  ) : null}
                </>
              ) : isLoadingPipeline ? (
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
                          if (activeLogsSubmissionId && activeLogsSubmissionStatus) {
                            void loadSubmissionLogs(activeLogsSubmissionId, activeLogsSubmissionStatus, run.id)
                          }
                        }}
                      >
                        {run.trigger}:{run.status}
                      </Button>
                    ))}
                  </div>

                  <div className="rounded-md border border-border bg-background/60 flex-1 min-h-0 flex flex-col overflow-hidden">
                    <pre className="flex-1 overflow-auto whitespace-pre-wrap p-3 text-xs text-foreground">
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
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!activeAiSubmissionId} onOpenChange={(open) => !open && setActiveAiSubmissionId(null)}>
        <DialogContent className="sm:max-w-[95vw] lg:max-w-4xl w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>AI Performance Report</DialogTitle>
            <DialogDescription>
              Candidate analysis and employer follow-up Q&A grounded in repository evidence.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 px-1 pb-4">
              {aiReportErrorMessage ? (
                <p className="text-sm text-destructive">{aiReportErrorMessage}</p>
              ) : null}

              {isLoadingAiReport ? (
                <p className="text-sm text-muted-foreground">Loading AI report...</p>
              ) : aiReportView ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background/60 p-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{aiReportView.submission.assignmentTitle}</p>
                      <a
                        href={toRepositoryHref(aiReportView.submission.repositoryUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="line-clamp-1 text-xs text-muted-foreground underline decoration-border underline-offset-2 hover:text-foreground"
                      >
                        {aiReportView.submission.repositoryUrl}
                      </a>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (activeAiSubmissionId) {
                          void loadSubmissionAiReport(activeAiSubmissionId)
                        }
                      }}
                      disabled={isLoadingAiReport}
                    >
                      <RefreshCwIcon className={isLoadingAiReport ? "animate-spin" : ""} />
                      Refresh report
                    </Button>
                  </div>

                  {aiReportView.report ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <SparklesIcon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">AI Analysis</p>
                            <p className="text-xs text-muted-foreground">Generated code review and architecture assessment</p>
                          </div>
                        </div>
                        <Badge variant={aiReportStatusBadgeVariantMap[aiReportView.report.status]} className="px-3 py-1 text-sm">
                          {aiReportView.report.status === "completed" ? "Completed" : aiReportView.report.status === "pending" ? "Analyzing..." : "Failed"}
                        </Badge>
                      </div>

                      {aiReportView.report.status === "pending" ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4 rounded-lg border border-dashed border-border">
                           <div className="relative flex h-12 w-12 items-center justify-center">
                             <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/20 opacity-75" />
                             <BrainCircuitIcon className="relative h-6 w-6 text-primary animate-pulse" />
                           </div>
                          <p className="text-sm text-muted-foreground">
                            Analysis is currently running. Refresh in a moment to load the completed report.
                          </p>
                        </div>
                      ) : null}

                      {aiReportView.report.status === "failed" ? (
                        <div className="flex flex-col items-center justify-center py-10 space-y-3 rounded-lg border border-destructive/20 bg-destructive/10">
                          <AlertTriangleIcon className="h-8 w-8 text-destructive" />
                          <p className="text-sm font-medium text-destructive">
                            {aiReportView.report.failureReason ?? "Unable to generate the report."}
                          </p>
                        </div>
                      ) : null}

                      {aiReportView.report.status === "completed" ? (
                        <div className="grid gap-6">
                          <div className="grid gap-4 md:grid-cols-2">
                            <Card className="shadow-sm">
                              <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                  <FileTextIcon className="h-4 w-4 text-primary" />
                                  Project overview
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <p className="text-sm leading-relaxed text-muted-foreground">{aiReportView.report.projectOverview}</p>
                              </CardContent>
                            </Card>

                            <Card className="shadow-sm">
                              <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-base">
                                  <CodeIcon className="h-4 w-4 text-primary" />
                                  Notable structure
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <p className="text-sm leading-relaxed text-muted-foreground">{aiReportView.report.notableStructure}</p>
                              </CardContent>
                            </Card>
                          </div>

                          <Card className="shadow-sm border-emerald-500/20 bg-emerald-500/5">
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-base text-emerald-600 dark:text-emerald-500">
                                <CheckCircle2Icon className="h-4 w-4" />
                                Engineering strengths
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ul className="grid gap-2 sm:grid-cols-2">
                                {aiReportView.report.engineeringStrengths.map((strength, i) => (
                                  <li key={i} className="flex items-start gap-2 rounded-md bg-background/50 px-3 py-2.5 text-sm shadow-sm border border-border/50">
                                    <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                                    <span className="leading-snug">{strength}</span>
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>

                          <Card className="shadow-sm border-amber-500/20 bg-amber-500/5">
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-base text-amber-600 dark:text-amber-500">
                                <AlertTriangleIcon className="h-4 w-4" />
                                Risks or concerns
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ul className="grid gap-2 sm:grid-cols-2">
                                {aiReportView.report.risksOrConcerns.map((risk, i) => (
                                  <li key={i} className="flex items-start gap-2 rounded-md bg-background/50 px-3 py-2.5 text-sm shadow-sm border border-border/50">
                                    <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                                    <span className="leading-snug">{risk}</span>
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>

                          <Card className="shadow-sm border-blue-500/20 bg-blue-500/5">
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-base text-blue-600 dark:text-blue-500">
                                <MessageSquareIcon className="h-4 w-4" />
                                Suggested follow-up questions
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ul className="grid gap-3">
                                {aiReportView.report.suggestedQuestions.map((question, i) => (
                                  <li key={i} className="flex items-start gap-3 rounded-md bg-background/50 p-3 text-sm shadow-sm border border-border/50 transition-colors hover:bg-background/80">
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-medium text-blue-600 dark:text-blue-500">
                                      {i + 1}
                                    </div>
                                    <span className="mt-0.5 leading-relaxed">{question}</span>
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 rounded-lg border border-dashed border-border bg-muted/30">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                        <SparklesIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-center text-sm font-medium text-foreground">
                        No AI report available
                      </p>
                      <p className="text-center text-sm text-muted-foreground mt-1 max-w-sm">
                        An AI report hasn't been generated for this submission yet.
                      </p>
                    </div>
                  )}

                  <div className="mt-8 space-y-4">
                    <div className="flex items-center gap-2">
                       <div className="h-px flex-1 bg-border" />
                       <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Follow-up Q&A</p>
                       <div className="h-px flex-1 bg-border" />
                    </div>
                    
                    <Card className="shadow-sm">
                      <CardHeader className="pb-4">
                        <CardDescription>
                          Ask free-form questions; answers are grounded in repository analysis and the generated report.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-4">
                          {aiReportView.messages.length > 0 ? (
                            <div className="space-y-4">
                              {aiReportView.messages.map((message) => (
                                <div
                                  key={message.id}
                                  className={`flex gap-3 ${message.role === "assistant" ? "" : "flex-row-reverse"}`}
                                >
                                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${message.role === "assistant" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                    {message.role === "assistant" ? <SparklesIcon className="h-4 w-4" /> : <span className="text-xs font-medium">You</span>}
                                  </div>
                                  <div className={`rounded-xl px-4 py-3 text-sm ${message.role === "assistant" ? "bg-muted/50 rounded-tl-none border border-border/50" : "bg-primary text-primary-foreground rounded-tr-none"}`}>
                                    <p className="whitespace-pre-wrap leading-relaxed">{message.message}</p>
                                    <p className={`mt-2 text-[10px] ${message.role === "assistant" ? "text-muted-foreground" : "text-primary-foreground/70 text-right"}`}>
                                      {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-6 text-center">
                              <MessageSquareIcon className="h-8 w-8 text-muted/50 mb-3" />
                              <p className="text-sm text-muted-foreground">
                                No questions asked yet for this submission.
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-end gap-3 pt-2">
                          <div className="flex-1 space-y-2">
                            <Textarea
                              id="ai-question"
                              value={aiQuestionDraft}
                              onChange={(event) => setAiQuestionDraft(event.target.value)}
                              placeholder={canAskAiQuestion ? "Ask about architecture, trade-offs, or specific features..." : "Wait for the AI report to finish before asking questions."}
                              className="min-h-[80px] resize-none"
                              disabled={!canAskAiQuestion || isAskingAiQuestion}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  if (canAskAiQuestion && !isAskingAiQuestion && aiQuestionDraft.trim().length > 0) {
                                    void handleAskAiQuestion();
                                  }
                                }
                              }}
                            />
                          </div>
                          <Button
                            size="icon"
                            className="h-[80px] w-[80px] shrink-0 rounded-md"
                            onClick={() => void handleAskAiQuestion()}
                            disabled={!canAskAiQuestion || isAskingAiQuestion || aiQuestionDraft.trim().length === 0}
                          >
                            {isAskingAiQuestion ? (
                               <RefreshCwIcon className="h-5 w-5 animate-spin" />
                            ) : (
                               <ArrowRightIcon className="h-5 w-5" />
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No AI report data available.</p>
              )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
