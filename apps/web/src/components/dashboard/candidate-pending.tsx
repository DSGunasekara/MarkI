import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
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
  candidateApi,
  toErrorMessage,
  type CandidateOverview,
  type DashboardSubmissionStatus,
  type SessionUser
} from "@/lib/api"

type CandidateWorkspaceProps = {
  user: SessionUser
  onSignOut: () => Promise<void>
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

export function CandidatePending({ user, onSignOut }: CandidateWorkspaceProps) {
  const [joinCode, setJoinCode] = useState("")
  const [repositoryUrl, setRepositoryUrl] = useState("")
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  const handleSubmitRepository = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedJoinCode = joinCode.trim().toUpperCase()
    const normalizedRepositoryUrl = repositoryUrl.trim()

    if (normalizedJoinCode.length < 4) {
      setSubmitErrorMessage("Join code is required.")
      return
    }

    if (normalizedRepositoryUrl.length === 0) {
      setSubmitErrorMessage("Repository URL is required.")
      return
    }

    setSubmitErrorMessage(null)
    setSubmitMessage(null)
    setIsSubmitting(true)

    try {
      const submissionResult = await candidateApi.submitRepository({
        joinCode: normalizedJoinCode,
        repositoryUrl: normalizedRepositoryUrl
      })

      setJoinCode("")
      setRepositoryUrl("")
      setSubmitMessage(
        submissionResult.isResubmission
          ? `Resubmitted for ${submissionResult.assignmentTitle}. Status reset to pending.`
          : `Submitted for ${submissionResult.assignmentTitle} (${submissionResult.joinCode}).`
      )
      await loadOverview("refresh")
    } catch (error: unknown) {
      setSubmitErrorMessage(toErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

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
    <div className="min-h-screen">
      <header className="app-header w-full">
        <div className="flex min-h-14 w-full flex-wrap items-center justify-between gap-3 px-4 py-2 md:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="size-2 rounded-full bg-primary" />
            <div>
              <p className="app-overline">Hiring Engine</p>
              <p className="text-sm font-medium">Candidate Workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{user.email}</Badge>
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

      <main className="w-full space-y-4 px-4 py-4 md:px-6 lg:px-8">
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

        <section className="grid gap-4 xl:grid-cols-[1.45fr_0.9fr]">
          <Card className="app-panel">
            <CardHeader>
              <CardTitle>My Submissions</CardTitle>
              <CardDescription>Track your latest assignment submissions and runner status updates.</CardDescription>
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
                <p className="text-sm text-muted-foreground">No submissions yet. Join an assignment to get started.</p>
              )}
            </CardContent>
          </Card>

          <Card className="app-panel xl:sticky xl:top-[4.5rem] xl:h-fit">
            <CardHeader>
              <CardTitle>Submit Repository</CardTitle>
              <CardDescription>
                Enter the employer-provided join code and your public GitHub repository URL.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmitRepository}>
                <div className="space-y-2">
                  <Label htmlFor="candidate-join-code" className="app-overline">
                    Join code
                  </Label>
                  <Input
                    id="candidate-join-code"
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                    className="h-10 border-input bg-background font-mono tracking-wider"
                    placeholder="AB12CD34"
                    maxLength={32}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="candidate-repository-url" className="app-overline">
                    GitHub repository URL
                  </Label>
                  <Input
                    id="candidate-repository-url"
                    value={repositoryUrl}
                    onChange={(event) => setRepositoryUrl(event.target.value)}
                    className="h-10 border-input bg-background"
                    placeholder="https://github.com/username/repository"
                    required
                  />
                </div>
                {submitMessage ? <p className="text-sm text-primary">{submitMessage}</p> : null}
                {submitErrorMessage ? <p className="text-sm text-destructive">{submitErrorMessage}</p> : null}
                <Button type="submit" className="h-10" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit repository"}
                </Button>
              </form>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">Resubmitting updates the same assignment submission and resets status to pending.</p>
            </CardFooter>
          </Card>
        </section>
      </main>
    </div>
  )
}
