import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"

import { WorkspaceShell } from "@/components/shared/workspace-shell"
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
  candidateApi,
  integrationApi,
  toErrorMessage,
  type GitHubAppConfig,
  type GitHubInstallationRepository,
  type SessionUser
} from "@/lib/api"

type CandidateSubmitRepositoryProps = {
  user: SessionUser
  onSignOut: () => Promise<void>
  onBackToDashboard: () => void
}

export function CandidateSubmitRepository({
  user,
  onSignOut,
  onBackToDashboard
}: CandidateSubmitRepositoryProps) {
  const [joinCode, setJoinCode] = useState("")
  const [repositoryUrl, setRepositoryUrl] = useState("")
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [githubAppConfig, setGitHubAppConfig] = useState<GitHubAppConfig | null>(null)
  const [isLoadingGitHubAppConfig, setIsLoadingGitHubAppConfig] = useState(true)
  const [gitHubAppConfigError, setGitHubAppConfigError] = useState<string | null>(null)
  const [installationId, setInstallationId] = useState("")
  const [repositories, setRepositories] = useState<GitHubInstallationRepository[]>([])
  const [selectedRepositoryFullName, setSelectedRepositoryFullName] = useState("")
  const [repositoriesErrorMessage, setRepositoriesErrorMessage] = useState<string | null>(null)
  const [isLoadingRepositories, setIsLoadingRepositories] = useState(false)

  const isGitHubAppSelectionMode = Boolean(githubAppConfig?.isConfigured)
  const selectedRepository = useMemo(() => {
    return repositories.find((repository) => repository.fullName === selectedRepositoryFullName) ?? null
  }, [repositories, selectedRepositoryFullName])

  const loadRepositories = useCallback(async (nextInstallationId: string) => {
    const normalizedInstallationId = nextInstallationId.trim()
    if (!/^\d+$/.test(normalizedInstallationId)) {
      setRepositoriesErrorMessage("Installation ID must be numeric.")
      setRepositories([])
      setSelectedRepositoryFullName("")
      return
    }

    setRepositoriesErrorMessage(null)
    setIsLoadingRepositories(true)

    try {
      const response = await candidateApi.getInstallationRepositories(normalizedInstallationId)
      setRepositories(response.repositories)
      setSelectedRepositoryFullName((current) => {
        if (current.length > 0 && response.repositories.some((repository) => repository.fullName === current)) {
          return current
        }

        return response.repositories[0]?.fullName ?? ""
      })
    } catch (error: unknown) {
      setRepositories([])
      setSelectedRepositoryFullName("")
      setRepositoriesErrorMessage(toErrorMessage(error))
    } finally {
      setIsLoadingRepositories(false)
    }
  }, [])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void (async () => {
        setIsLoadingGitHubAppConfig(true)
        setGitHubAppConfigError(null)

        try {
          const config = await integrationApi.getGitHubAppConfig()
          setGitHubAppConfig(config)

          if (config.isConfigured) {
            const params = new URLSearchParams(window.location.search)
            const installationIdFromQuery = params.get("installation_id")
            if (installationIdFromQuery && /^\d+$/.test(installationIdFromQuery)) {
              setInstallationId(installationIdFromQuery)
              await loadRepositories(installationIdFromQuery)
            }
          }
        } catch (error: unknown) {
          setGitHubAppConfigError(toErrorMessage(error))
        } finally {
          setIsLoadingGitHubAppConfig(false)
        }
      })()
    }, 0)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [loadRepositories])

  const handleSubmitRepository = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedJoinCode = joinCode.trim().toUpperCase()
    if (normalizedJoinCode.length < 4) {
      setErrorMessage("Join code is required.")
      return
    }

    if (isGitHubAppSelectionMode) {
      if (installationId.trim().length === 0) {
        setErrorMessage("Installation ID is required.")
        return
      }

      if (selectedRepositoryFullName.length === 0) {
        setErrorMessage("Select a repository to submit.")
        return
      }
    } else if (repositoryUrl.trim().length === 0) {
      setErrorMessage("Repository URL is required.")
      return
    }

    setErrorMessage(null)
    setSubmitMessage(null)
    setIsSubmitting(true)

    try {
      const submissionResult = isGitHubAppSelectionMode
        ? await candidateApi.submitRepository({
            joinCode: normalizedJoinCode,
            repositoryFullName: selectedRepositoryFullName,
            githubInstallationId: installationId.trim()
          })
        : await candidateApi.submitRepository({
            joinCode: normalizedJoinCode,
            repositoryUrl: repositoryUrl.trim()
          })

      setJoinCode("")
      setRepositoryUrl("")
      setSubmitMessage(
        submissionResult.isResubmission
          ? `Resubmitted for ${submissionResult.assignmentTitle}. Build queued (${submissionResult.pipelineRunId.slice(0, 8)}).`
          : `Submitted for ${submissionResult.assignmentTitle} (${submissionResult.joinCode}). Build queued (${submissionResult.pipelineRunId.slice(0, 8)}).`
      )
    } catch (error: unknown) {
      setErrorMessage(toErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <WorkspaceShell
      workspaceLabel="Candidate Workspace"
      title="Submit Repository"
      description="Submit or resubmit your assignment repository using the join code."
      userEmail={user.email}
      navItems={[
        {
          key: "dashboard",
          label: "Dashboard",
          isActive: false,
          onClick: onBackToDashboard
        },
        {
          key: "submit-repository",
          label: "Submit Repository",
          isActive: true,
          onClick: () => {
            // no-op: already on submit repository
          }
        }
      ]}
      onSignOut={onSignOut}
      maxWidthClassName="max-w-4xl"
    >
      <section className="space-y-4">
        <Card className="app-panel">
          <CardHeader>
            <CardTitle>GitHub App Connection</CardTitle>
            <CardDescription>
              Install the Hiring Engine GitHub App on your repository so pushes trigger automatic rebuilds.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoadingGitHubAppConfig ? (
              <p className="text-sm text-muted-foreground">Loading GitHub App configuration...</p>
            ) : gitHubAppConfigError ? (
              <p className="text-sm text-destructive">{gitHubAppConfigError}</p>
            ) : githubAppConfig?.isConfigured ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Install the GitHub App, then select the repository from your installation.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {githubAppConfig.installUrl ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={githubAppConfig.installUrl} target="_blank" rel="noreferrer">
                        Install GitHub App
                      </a>
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Install URL unavailable. Contact support with app slug configuration.
                    </p>
                  )}
                </div>

                <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="github-installation-id" className="app-overline">
                      Installation ID
                    </Label>
                    <Input
                      id="github-installation-id"
                      value={installationId}
                      onChange={(event) => setInstallationId(event.target.value)}
                      className="h-10 border-input bg-background font-mono"
                      placeholder="12345678"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10"
                    onClick={() => {
                      void loadRepositories(installationId)
                    }}
                    disabled={isLoadingRepositories}
                  >
                    {isLoadingRepositories ? "Loading repositories..." : "Load repositories"}
                  </Button>
                </div>

                {repositoriesErrorMessage ? (
                  <p className="text-sm text-destructive">{repositoriesErrorMessage}</p>
                ) : null}

                {repositories.length > 0 ? (
                  <div className="space-y-2">
                    <Label htmlFor="github-repository-select" className="app-overline">
                      Repository
                    </Label>
                    <Select
                      value={selectedRepositoryFullName}
                      onValueChange={setSelectedRepositoryFullName}
                    >
                      <SelectTrigger
                        id="github-repository-select"
                        className="h-10 w-full border-input bg-background"
                      >
                        <SelectValue placeholder="Select repository" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {repositories.map((repository) => (
                            <SelectItem key={repository.fullName} value={repository.fullName}>
                              {repository.fullName}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {selectedRepository ? (
                      <p className="text-xs text-muted-foreground">
                        Branch {selectedRepository.defaultBranch} ·{" "}
                        {selectedRepository.isPrivate ? "Private" : "Public"}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No repositories loaded yet. Install the app and load your installation repositories.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                GitHub App is not configured on the server yet. Submission will still work, but push-triggered rebuilds will not be enforced by app installation checks.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="app-panel">
          <CardHeader>
            <CardTitle>Assignment Submission</CardTitle>
            <CardDescription>
              Enter your assignment join code and public GitHub repository URL.
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
              {isGitHubAppSelectionMode ? (
                <div className="space-y-2">
                  <Label className="app-overline">Selected repository</Label>
                  <Input
                    value={selectedRepositoryFullName}
                    readOnly
                    className="h-10 border-input bg-background font-mono"
                    placeholder="Load repositories and select one"
                  />
                </div>
              ) : (
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
              )}

              {submitMessage ? <p className="text-sm text-primary">{submitMessage}</p> : null}
              {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  className="h-10"
                  disabled={
                    isSubmitting ||
                    (isGitHubAppSelectionMode &&
                      (installationId.trim().length === 0 || selectedRepositoryFullName.length === 0))
                  }
                >
                  {isSubmitting ? "Submitting..." : "Submit repository"}
                </Button>
                <Button type="button" variant="outline" onClick={onBackToDashboard}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              If you already submitted for this assignment, this updates your existing record and resets status to pending.
            </p>
          </CardFooter>
        </Card>
      </section>
    </WorkspaceShell>
  )
}
