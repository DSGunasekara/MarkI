import { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCwIcon } from "lucide-react"

import { WorkspaceShell } from "@/components/shared/workspace-shell"
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
import {
  dashboardApi,
  toErrorMessage,
  type DashboardSubmissionStatus,
  type EmployerSubmissionExplorer,
  type EmployerSubmissionsSort,
  type SessionUser
} from "@/lib/api"

type EmployerSubmissionsExplorerProps = {
  user: SessionUser
  onSignOut: () => Promise<void>
  onBackToDashboard: () => void
  onOpenCreateAssignment: () => void
  initialAssignmentId?: string | null
}

type ExplorerFilterDraft = {
  assignmentId: string
  status: "all" | DashboardSubmissionStatus
  search: string
  sort: EmployerSubmissionsSort
}

type LoadMode = "initial" | "refresh"

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
  user,
  onSignOut,
  onBackToDashboard,
  onOpenCreateAssignment,
  initialAssignmentId
}: EmployerSubmissionsExplorerProps) {
  const [draftFilters, setDraftFilters] = useState<ExplorerFilterDraft>(DEFAULT_FILTERS)
  const [activeFilters, setActiveFilters] = useState<ExplorerFilterDraft>(DEFAULT_FILTERS)
  const [offset, setOffset] = useState(0)

  const [explorerData, setExplorerData] = useState<EmployerSubmissionExplorer | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeLogsSubmissionId, setActiveLogsSubmissionId] = useState<string | null>(null)
  const [pipelineErrorMessage, setPipelineErrorMessage] = useState<string | null>(null)
  const [isLoadingPipeline, setIsLoadingPipeline] = useState(false)
  const [pipelineView, setPipelineView] = useState<Awaited<
    ReturnType<typeof dashboardApi.getSubmissionLogs>
  > | null>(null)

  const fetchExplorerData = useCallback(async (mode: LoadMode) => {
    if (mode === "initial") {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }

    setErrorMessage(null)

    try {
      const response = await dashboardApi.getSubmissions({
        assignmentId: activeFilters.assignmentId === "all" ? undefined : activeFilters.assignmentId,
        status: activeFilters.status === "all" ? undefined : activeFilters.status,
        search: activeFilters.search,
        sort: activeFilters.sort,
        limit: DEFAULT_LIMIT,
        offset
      })

      setExplorerData(response)
    } catch (error: unknown) {
      setErrorMessage(toErrorMessage(error))
    } finally {
      if (mode === "initial") {
        setIsLoading(false)
      } else {
        setIsRefreshing(false)
      }
    }
  }, [activeFilters, offset])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void fetchExplorerData("initial")
    }, 0)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [fetchExplorerData])

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

  const handleApplyFilters = () => {
    setOffset(0)
    setActiveFilters(draftFilters)
  }

  const handleClearFilters = () => {
    setOffset(0)
    setDraftFilters(DEFAULT_FILTERS)
    setActiveFilters(DEFAULT_FILTERS)
  }

  const loadSubmissionLogs = useCallback(
    async (submissionId: string, runId?: string) => {
      setIsLoadingPipeline(true)
      setPipelineErrorMessage(null)
      setActiveLogsSubmissionId(submissionId)

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
    []
  )

  return (
    <WorkspaceShell
      workspaceLabel="Employer Workspace"
      title="Submissions Explorer"
      description="Filter and inspect submissions grouped by assignment."
      userEmail={user.email}
      navItems={[
        {
          key: "dashboard",
          label: "Dashboard",
          isActive: false,
          onClick: onBackToDashboard
        },
        {
          key: "create-assignment",
          label: "Create Assignment",
          isActive: false,
          onClick: onOpenCreateAssignment
        },
        {
          key: "submissions",
          label: "Submissions",
          isActive: true,
          onClick: () => {
            // no-op: already on submissions explorer
          }
        }
      ]}
      onSignOut={onSignOut}
    >
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
                onClick={() => {
                  void fetchExplorerData("refresh")
                }}
                disabled={isRefreshing}
              >
                <RefreshCwIcon className={isRefreshing ? "animate-spin" : ""} />
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

        {isLoading && !explorerData ? (
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

        {activeLogsSubmissionId ? (
          <Card className="app-panel">
            <CardHeader>
              <CardTitle>Pipeline Logs</CardTitle>
              <CardDescription>
                Review build and deployment output for the selected submission.
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
    </WorkspaceShell>
  )
}
