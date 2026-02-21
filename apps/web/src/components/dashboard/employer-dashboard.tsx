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
import {
  dashboardApi,
  toErrorMessage,
  type DashboardOverview,
  type DashboardSubmissionStatus,
  type SessionUser
} from "@/lib/api"

type EmployerDashboardProps = {
  user: SessionUser
  onSignOut: () => Promise<void>
  onOpenCreateAssignment: () => void
  onOpenSubmissionsExplorer: () => void
}

type OverviewLoadMode = "initial" | "refresh"

type SubmissionBadgeVariant = "default" | "secondary" | "destructive" | "outline"

const statusBadgeVariantMap: Record<DashboardSubmissionStatus, SubmissionBadgeVariant> = {
  pending: "secondary",
  building: "outline",
  deployed: "default",
  failed: "destructive"
}

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return "-"
  }

  return new Date(value).toLocaleString()
}

const toRepositoryHref = (repositoryUrl: string): string => {
  if (repositoryUrl.startsWith("http://") || repositoryUrl.startsWith("https://")) {
    return repositoryUrl
  }

  return `https://${repositoryUrl}`
}

export function EmployerDashboard({
  user,
  onSignOut,
  onOpenCreateAssignment,
  onOpenSubmissionsExplorer
}: EmployerDashboardProps) {
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [overviewErrorMessage, setOverviewErrorMessage] = useState<string | null>(null)
  const [isLoadingOverview, setIsLoadingOverview] = useState(true)
  const [isRefreshingOverview, setIsRefreshingOverview] = useState(false)

  const loadOverview = useCallback(async (mode: OverviewLoadMode) => {
    if (mode === "initial") {
      setIsLoadingOverview(true)
    } else {
      setIsRefreshingOverview(true)
    }

    setOverviewErrorMessage(null)

    try {
      const response = await dashboardApi.getOverview({
        assignmentsLimit: 10,
        submissionsLimit: 12
      })

      setOverview(response)
    } catch (error: unknown) {
      setOverviewErrorMessage(toErrorMessage(error))
    } finally {
      if (mode === "initial") {
        setIsLoadingOverview(false)
      } else {
        setIsRefreshingOverview(false)
      }
    }
  }, [])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadOverview("initial")
    }, 0)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [loadOverview])

  const metrics = useMemo(() => {
    return (
      overview?.metrics ?? {
        assignmentCount: 0,
        submissionCount: 0,
        pendingCount: 0,
        buildingCount: 0,
        deployedCount: 0,
        failedCount: 0
      }
    )
  }, [overview])

  return (
    <div className="min-h-screen">
      <header className="app-header w-full">
        <div className="flex min-h-14 w-full flex-wrap items-center justify-between gap-3 px-4 py-2 md:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="size-2 rounded-full bg-primary" />
            <div>
              <p className="app-overline">Hiring Engine</p>
              <p className="text-sm font-medium">Employer Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{user.email}</Badge>
            <Button size="sm" onClick={onOpenCreateAssignment}>
              New assignment
            </Button>
            <Button size="sm" variant="outline" onClick={onOpenSubmissionsExplorer}>
              All submissions
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void loadOverview("refresh")
              }}
              disabled={isRefreshingOverview}
            >
              <RefreshCwIcon className={isRefreshingOverview ? "animate-spin" : ""} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => void onSignOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-4 md:px-6 lg:px-8">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Card className="app-panel">
            <CardContent className="space-y-1 py-4">
              <p className="app-overline">Assignments</p>
              <p className="text-2xl font-semibold">{metrics.assignmentCount}</p>
            </CardContent>
          </Card>
          <Card className="app-panel">
            <CardContent className="space-y-1 py-4">
              <p className="app-overline">Submissions</p>
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

        {overviewErrorMessage ? (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="py-3 text-sm text-destructive">{overviewErrorMessage}</CardContent>
          </Card>
        ) : null}

        <section className="space-y-4">
          <Card className="app-panel">
            <CardHeader>
              <CardTitle>Recent Assignments</CardTitle>
              <CardDescription>
                Track assignment usage and candidate activity without leaving the dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingOverview && !overview ? (
                <p className="text-sm text-muted-foreground">Loading assignments...</p>
              ) : overview && overview.recentAssignments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Assignment</th>
                        <th className="px-3 py-2 font-medium">Join code</th>
                        <th className="px-3 py-2 font-medium">Submissions</th>
                        <th className="px-3 py-2 font-medium">Latest submission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.recentAssignments.map((assignment) => (
                        <tr key={assignment.id} className="border-b border-border/60 align-top">
                          <td className="px-3 py-3">
                            <p className="font-medium">{assignment.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              created {formatDateTime(assignment.createdAt)}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <Badge variant="outline" className="font-mono tracking-wider">
                              {assignment.joinCode}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">{assignment.submissionCount}</td>
                          <td className="px-3 py-3 text-muted-foreground">{formatDateTime(assignment.latestSubmissionAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No assignments yet. Create one to start your pipeline.</p>
              )}
            </CardContent>
            <CardFooter>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={onOpenCreateAssignment}>
                  Create assignment
                </Button>
                <Button size="sm" variant="outline" onClick={onOpenSubmissionsExplorer}>
                  View all submissions
                </Button>
              </div>
            </CardFooter>
          </Card>

          <Card className="app-panel">
            <CardHeader>
              <CardTitle>Recent Submissions</CardTitle>
              <CardDescription>
                Review candidate repositories and live pipeline status across assignments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingOverview && !overview ? (
                <p className="text-sm text-muted-foreground">Loading submissions...</p>
              ) : overview && overview.recentSubmissions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Assignment</th>
                        <th className="px-3 py-2 font-medium">Repository</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.recentSubmissions.map((submission) => (
                        <tr key={submission.id} className="border-b border-border/60 align-top">
                          <td className="px-3 py-3">
                            <p className="font-medium">{submission.assignmentTitle}</p>
                            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                              candidate {submission.candidateId.slice(0, 8)}
                            </p>
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
                          <td className="px-3 py-3 text-muted-foreground">{formatDateTime(submission.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No submissions yet. Candidate activity will appear here.</p>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
