import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

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
  toErrorMessage
} from "@/lib/api"

export function CandidateSubmitRepository() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [joinCode, setJoinCode] = useState("")
  const [repositoryUrl, setRepositoryUrl] = useState("")
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  const initialInstallationId = useMemo(() => {
    if (typeof window === "undefined") return ""
    const params = new URLSearchParams(window.location.search)
    const paramId = params.get("installation_id")
    if (paramId) {
      localStorage.setItem("codr_github_installation_id", paramId)
      return paramId
    }
    return localStorage.getItem("codr_github_installation_id") ?? ""
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      if (params.has("installation_id")) {
        const nextUrl = window.location.pathname
        window.history.replaceState({}, "", nextUrl)
      }
    }
  }, [])

  const [selectedRepositoryFullName, setSelectedRepositoryFullName] = useState("")

  const {
    data: githubAppConfig,
    isLoading: isLoadingGitHubAppConfig,
    error: gitHubAppConfigQueryError
  } = useQuery({
    queryKey: ["integrations", "github-app-config"],
    queryFn: () => integrationApi.getGitHubAppConfig()
  })

  const gitHubAppConfigError = gitHubAppConfigQueryError ? toErrorMessage(gitHubAppConfigQueryError) : null

  const isGitHubAppSelectionMode = Boolean(githubAppConfig?.isConfigured)

  const normalizedInstallationId = initialInstallationId.trim()
  const isInstallationIdValid = normalizedInstallationId.length === 0 || /^\d+$/.test(normalizedInstallationId)

  const {
    data: repositoriesData,
    isFetching: isFetchingRepositories,
    error: repositoriesQueryError,
    refetch: refetchRepositories
  } = useQuery({
    queryKey: ["candidate", "repositories", normalizedInstallationId],
    queryFn: () => candidateApi.getInstallationRepositories(
        normalizedInstallationId.length > 0 ? normalizedInstallationId : undefined
    ),
    enabled: isGitHubAppSelectionMode && isInstallationIdValid
  })

  // Derive the final installation ID to show logic (e.g. uninstall URL) from the backend data
  const effectiveInstallationId = repositoriesData?.installationId ?? String(initialInstallationId)

  const repositories = repositoriesData?.repositories ?? []
  const repositoriesErrorMessage = !isInstallationIdValid
    ? "Installation ID must be numeric."
    : repositoriesQueryError
      ? toErrorMessage(repositoriesQueryError)
      : null

  const isLoadingRepositories = isFetchingRepositories

  useEffect(() => {
    if (repositories.length > 0) {
      setSelectedRepositoryFullName((current) => {
        if (current.length > 0 && repositories.some((repository) => repository.fullName === current)) {
          return current
        }
        return repositories[0]?.fullName ?? ""
      })
    }
  }, [repositories])

  const selectedRepository = useMemo(() => {
    return repositories.find((repository) => repository.fullName === selectedRepositoryFullName) ?? null
  }, [repositories, selectedRepositoryFullName])
  const uninstallUrl = useMemo(() => {
    if (!effectiveInstallationId) {
      return null
    }

    return `https://github.com/settings/installations/${effectiveInstallationId}`
  }, [effectiveInstallationId])

  const submitMutation = useMutation({
    mutationFn: async (input: {
      joinCode: string
      repositoryUrl?: string
      repositoryFullName?: string
      githubInstallationId?: string
    }) => {
      return candidateApi.submitRepository(input)
    },
    onSuccess: (submissionResult) => {
      setJoinCode("")
      setRepositoryUrl("")
      setSubmitMessage(
        submissionResult.isResubmission
          ? `Resubmitted for ${submissionResult.assignmentTitle}. Build queued (${submissionResult.pipelineRunId.slice(0, 8)}).`
          : `Submitted for ${submissionResult.assignmentTitle} (${submissionResult.joinCode}). Build queued (${submissionResult.pipelineRunId.slice(0, 8)}).`
      )

      void queryClient.invalidateQueries({ queryKey: ["candidate"] })
    },
    onError: (error: unknown) => {
      setErrorMessage(toErrorMessage(error))
    }
  })

  const handleSubmitRepository = (event: FormEvent<HTMLFormElement>) => {
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

    if (isGitHubAppSelectionMode) {
      submitMutation.mutate({
        joinCode: normalizedJoinCode,
        repositoryFullName: selectedRepositoryFullName,
        githubInstallationId:
          effectiveInstallationId.trim().length > 0 ? effectiveInstallationId.trim() : undefined
      })
    } else {
      submitMutation.mutate({
        joinCode: normalizedJoinCode,
        repositoryUrl: repositoryUrl.trim()
      })
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4 md:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Submit Repository</h1>
          <p className="text-sm text-muted-foreground">Submit or resubmit your assignment repository using the join code.</p>
        </div>
      </div>
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
                  {!effectiveInstallationId && githubAppConfig.installUrl ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={githubAppConfig.installUrl} target="_blank" rel="noreferrer">
                        Install GitHub App
                      </a>
                    </Button>
                  ) : null}
                  {!effectiveInstallationId && !githubAppConfig.installUrl ? (
                    <p className="text-sm text-muted-foreground">
                      Install URL unavailable. Contact support with app slug configuration.
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10"
                    onClick={() => {
                      void refetchRepositories()
                    }}
                    disabled={isLoadingRepositories}
                  >
                    {isLoadingRepositories ? "Loading repositories..." : "Load repositories"}
                  </Button>
                  {effectiveInstallationId && uninstallUrl ? (
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
                    {effectiveInstallationId
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
                    submitMutation.isPending ||
                    (isGitHubAppSelectionMode && selectedRepositoryFullName.length === 0)
                  }
                >
                  {submitMutation.isPending ? "Submitting..." : "Submit repository"}
                </Button>
                <Button type="button" variant="outline" onClick={() => void navigate({ to: "/candidate" })}>
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
    </div>
  )
}
