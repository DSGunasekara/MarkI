import { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCwIcon } from "lucide-react"

import { WorkspaceShell } from "@/components/shared/workspace-shell"
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
  type CandidateOverview,
  type DashboardSubmissionStatus,
  type SessionUser
} from "@/lib/api"

type CandidateDashboardProps = {
  user: SessionUser
  onSignOut: () => Promise<void>
  onOpenSubmitRepository: () => void
}

type OverviewLoadMode = "initial" | "refresh"

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

export function CandidatePending({
  user,
  onSignOut,
  onOpenSubmitRepository
}: CandidateDashboardProps) {
  const [overview, setOverview] = useState<CandidateOverview | null>(null)
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
      const response = await candidateApi.getOverview({ submissionsLimit: 12 })
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
        submissionCount: 0,
        pendingCount: 0,
        buildingCount: 0,
        deployedCount: 0,
        failedCount: 0
      }
    )
  }, [overview])

  return (
    <WorkspaceShell
      workspaceLabel="Candidate Workspace"
      title="Dashboard"
      description="Track your submission pipeline and assignment progress."
      userEmail={user.email}
      navItems={[
        {
          key: "dashboard",
          label: "Dashboard",
          isActive: true,
          onClick: () => {
            // no-op: already on dashboard
          }
        },
        {
          key: "submit-repository",
          label: "Submit Repository",
          isActive: false,
          onClick: onOpenSubmitRepository
        }
      ]}
      onSignOut={onSignOut}
      headerActions={
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
      }
    >
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

        {overviewErrorMessage ? (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="py-3 text-sm text-destructive">{overviewErrorMessage}</CardContent>
          </Card>
        ) : null}

        <Card className="app-panel">
          <CardHeader>
            <CardTitle>My Recent Submissions</CardTitle>
            <CardDescription>Track your assignment submissions and runner status updates.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingOverview && !overview ? (
              <p className="text-sm text-muted-foreground">Loading submissions...</p>
            ) : overview && overview.recentSubmissions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Assignment</th>
                      <th className="px-3 py-2 font-medium">Join code</th>
                      <th className="px-3 py-2 font-medium">Repository</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Updated</th>
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
                          <Badge variant={statusBadgeVariantMap[submission.status]}>{submission.status}</Badge>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{formatDateTime(submission.updatedAt)}</td>
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
      </section>
    </WorkspaceShell>
  )
}
