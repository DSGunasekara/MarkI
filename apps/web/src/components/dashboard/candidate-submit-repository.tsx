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
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList
} from "@/components/ui/combobox"
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
  const uninstallUrl = useMemo(() => {
    if (!installationId) {
      return null
    }

    return `https://github.com/settings/installations/${installationId}`
  }, [installationId])

  const loadRepositories = useCallback(async (nextInstallationId?: string) => {
    const normalizedInstallationId = (nextInstallationId ?? installationId).trim()
    if (normalizedInstallationId.length > 0 && !/^\d+$/.test(normalizedInstallationId)) {
      setRepositoriesErrorMessage("Installation ID must be numeric.")
      setRepositories([])
      setSelectedRepositoryFullName("")
      return
    }

    setRepositoriesErrorMessage(null)
    setIsLoadingRepositories(true)

    try {
      const response = await candidateApi.getInstallationRepositories(
        normalizedInstallationId.length > 0 ? normalizedInstallationId : undefined
      )
      setInstallationId(response.installationId ?? "")
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
  }, [installationId])

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

              const nextUrl = window.location.pathname
              window.history.replaceState({}, "", nextUrl)
            } else {
              await loadRepositories()
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
            githubInstallationId:
              installationId.trim().length > 0 ? installationId.trim() : undefined
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
      user={{ name: user.name, email: user.email, avatar: "" }}
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
              Install the Codr AI GitHub App on your repository so pushes trigger automatic rebuilds.
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
                  Install the GitHub App, then load and select a repository from your installation.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {!installationId && githubAppConfig.installUrl ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={githubAppConfig.installUrl} target="_blank" rel="noreferrer">
                        Install GitHub App
                      </a>
                    </Button>
                  ) : null}
                  {!installationId && !githubAppConfig.installUrl ? (
                    <p className="text-sm text-muted-foreground">
                      Install URL unavailable. Contact support with app slug configuration.
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10"
                    onClick={() => {
                      void loadRepositories()
                    }}
                    disabled={isLoadingRepositories}
                  >
                    {isLoadingRepositories ? "Loading repositories..." : "Load repositories"}
                  </Button>
                  {installationId && uninstallUrl ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={uninstallUrl} target="_blank" rel="noreferrer">
                        Uninstall GitHub App
                      </a>
                    </Button>
                  ) : null}
                </div>

                {repositoriesErrorMessage ? (
                  <p className="text-sm text-destructive">{repositoriesErrorMessage}</p>
                ) : null}

                {repositories.length > 0 ? (
                  <div className="space-y-2">
                    <Label htmlFor="github-repository-select" className="app-overline">
                      Repository
                    </Label>
                    <Combobox
                      items={repositories.map((repository) => repository.fullName)}
                      value={selectedRepositoryFullName || null}
                      onValueChange={(value) => {
                        setSelectedRepositoryFullName(value ?? "")
                      }}
                    >
                      <ComboboxInput
                        id="github-repository-select"
                        placeholder="Search and select repository"
                        className="w-full"
                        showClear
                        required
                      />
                      <ComboboxContent>
                        <ComboboxEmpty>No repositories found.</ComboboxEmpty>
                        <ComboboxList>
                          {(item) => (
                            <ComboboxItem key={item} value={item}>
                              {item}
                            </ComboboxItem>
                          )}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                    {selectedRepository ? (
                      <p className="text-xs text-muted-foreground">
                        Branch {selectedRepository.defaultBranch} ·{" "}
                        {selectedRepository.isPrivate ? "Private" : "Public"}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {installationId
                      ? "No repositories found for this installation."
                      : "No saved installation found yet. Install the app once, then load repositories."}
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
                    (isGitHubAppSelectionMode && selectedRepositoryFullName.length === 0)
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
