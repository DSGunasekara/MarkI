import { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCwIcon } from "lucide-react"

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

  return (
    <div className="min-h-screen">
      <header className="app-header w-full">
        <div className="flex min-h-14 w-full flex-wrap items-center justify-between gap-3 px-4 py-2 md:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="size-2 rounded-full bg-primary" />
            <div>
              <p className="app-overline">Hiring Engine</p>
              <p className="text-sm font-medium">Submissions Explorer</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{user.email}</Badge>
            <Button size="sm" onClick={onOpenCreateAssignment}>
              New assignment
            </Button>
            <Button size="sm" variant="outline" onClick={onBackToDashboard}>
              Back to dashboard
            </Button>
            <Button variant="outline" size="sm" onClick={() => void onSignOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-4 md:px-6 lg:px-8">
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
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 font-medium">Created</th>
                          <th className="px-3 py-2 font-medium">Updated</th>
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
                              <Badge variant={statusBadgeVariantMap[submission.status]}>{submission.status}</Badge>
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">{formatDateTime(submission.createdAt)}</td>
                            <td className="px-3 py-3 text-muted-foreground">{formatDateTime(submission.updatedAt)}</td>
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
      </main>
    </div>
  )
}
