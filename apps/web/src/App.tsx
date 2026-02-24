import { useCallback, useEffect, useState } from "react"

import { AuthPanel } from "@/components/auth/auth-panel"
import { CandidatePending } from "@/components/dashboard/candidate-pending"
import { CandidateSubmitRepository } from "@/components/dashboard/candidate-submit-repository"
import { EmployerCreateAssignment } from "@/components/dashboard/employer-create-assignment"
import { EmployerDashboard } from "@/components/dashboard/employer-dashboard"
import { EmployerSubmissionsExplorer } from "@/components/dashboard/employer-submissions-explorer"
import { PlatformLanding } from "@/components/marketing/platform-landing"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  authApi,
  isUnauthorizedError,
  toErrorMessage,
  type SessionState,
  type UserRole
} from "@/lib/api"

type BootstrapStatus = "loading" | "ready" | "error"

type NavigateMode = "push" | "replace"

const EMPLOYER_DASHBOARD_PATH = "/employer/dashboard"
const EMPLOYER_CREATE_ASSIGNMENT_PATH = "/employer/assignments/new"
const EMPLOYER_SUBMISSIONS_PATH = "/employer/submissions"
const CANDIDATE_DASHBOARD_PATH = "/candidate/dashboard"
const CANDIDATE_SUBMIT_REPOSITORY_PATH = "/candidate/submissions/new"
const LANDING_PATH = "/"
const AUTH_LOGIN_PATH = "/auth/login"

const getDefaultPathForRole = (role: UserRole): string => {
  return role === "employer" ? EMPLOYER_DASHBOARD_PATH : CANDIDATE_DASHBOARD_PATH
}

const isPublicPath = (pathname: string): boolean => {
  return pathname === LANDING_PATH || pathname === AUTH_LOGIN_PATH
}

const isAllowedPathForRole = (role: UserRole, pathname: string): boolean => {
  if (role === "employer") {
    return (
      pathname === EMPLOYER_DASHBOARD_PATH ||
      pathname === EMPLOYER_CREATE_ASSIGNMENT_PATH ||
      pathname === EMPLOYER_SUBMISSIONS_PATH
    )
  }

  return pathname === CANDIDATE_DASHBOARD_PATH || pathname === CANDIDATE_SUBMIT_REPOSITORY_PATH
}

function App() {
  const [status, setStatus] = useState<BootstrapStatus>("loading")
  const [session, setSession] = useState<SessionState | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pathname, setPathname] = useState<string>(() => window.location.pathname)
  const [search, setSearch] = useState<string>(() => window.location.search)

  useEffect(() => {
    document.documentElement.classList.add("dark")
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname)
      setSearch(window.location.search)
    }

    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [])

  const navigate = useCallback((nextPath: string, mode: NavigateMode = "push") => {
    const nextUrl = new URL(nextPath, window.location.origin)
    const nextPathname = nextUrl.pathname
    const nextSearch = nextUrl.search

    const currentPath = window.location.pathname
    const currentSearch = window.location.search

    if (currentPath === nextPathname && currentSearch === nextSearch) {
      setPathname(nextPathname)
      setSearch(nextSearch)
      return
    }

    const nextLocation = `${nextPathname}${nextSearch}`

    if (mode === "replace") {
      window.history.replaceState({}, "", nextLocation)
    } else {
      window.history.pushState({}, "", nextLocation)
    }

    setPathname(nextPathname)
    setSearch(nextSearch)
  }, [])

  const refreshSession = useCallback(async () => {
    setStatus("loading")
    setErrorMessage(null)

    try {
      const activeSession = await authApi.getSession()
      setSession(activeSession)
      setStatus("ready")
    } catch (error: unknown) {
      if (isUnauthorizedError(error)) {
        setSession(null)
        setStatus("ready")
        return
      }

      setErrorMessage(toErrorMessage(error))
      setStatus("error")
    }
  }, [])

  const handleSignOut = useCallback(async () => {
    await authApi.signOut()
    navigate(LANDING_PATH, "replace")
    await refreshSession()
  }, [navigate, refreshSession])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void refreshSession()
    }, 0)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [refreshSession])

  useEffect(() => {
    if (!session) {
      return
    }

    const role = session.user.role
    if (isAllowedPathForRole(role, pathname)) {
      return
    }

    navigate(getDefaultPathForRole(role), "replace")
  }, [navigate, pathname, session])

  useEffect(() => {
    if (status !== "ready" || session) {
      return
    }

    if (isPublicPath(pathname)) {
      return
    }

    const nextTarget = `${pathname}${search}`
    const query = new URLSearchParams({
      next: nextTarget
    })

    navigate(`${AUTH_LOGIN_PATH}?${query.toString()}`, "replace")
  }, [navigate, pathname, search, session, status])

  if (status === "loading") {
    return (
      <main className="app-shell dark flex items-center justify-center px-4 py-16">
        <Card className="app-panel w-full max-w-md">
          <CardHeader>
            <CardTitle>Loading workspace...</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Checking your current session.</p>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (status === "error") {
    return (
      <main className="app-shell dark flex items-center justify-center px-4 py-16">
        <Card className="app-panel w-full max-w-md">
          <CardHeader>
            <CardTitle>Unable to load session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-destructive">{errorMessage ?? "Unknown error."}</p>
            <Button onClick={() => void refreshSession()}>Retry</Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (!session) {
    const redirectTargetFromSearch = new URLSearchParams(search).get("next")

    const handleAuthenticated = async () => {
      await refreshSession()
      if (redirectTargetFromSearch && redirectTargetFromSearch.startsWith("/")) {
        navigate(redirectTargetFromSearch, "replace")
      }
    }

    return (
      <div className="app-shell dark">
        {pathname === AUTH_LOGIN_PATH ? (
          <AuthPanel onAuthenticated={handleAuthenticated} onNavigateHome={() => navigate(LANDING_PATH)} />
        ) : (
          <PlatformLanding onOpenAuth={() => navigate(AUTH_LOGIN_PATH)} onNavigateHome={() => navigate(LANDING_PATH)} />
        )}
      </div>
    )
  }

  const role = session.user.role
  const resolvedPath =
    isAllowedPathForRole(role, pathname) ? pathname : getDefaultPathForRole(role)
  const assignmentIdFromSearch = new URLSearchParams(search).get("assignmentId")

  return (
    <div className="app-shell dark">
      {role === "employer" ? (
        resolvedPath === EMPLOYER_CREATE_ASSIGNMENT_PATH ? (
          <EmployerCreateAssignment
            user={session.user}
            onSignOut={handleSignOut}
            onBackToDashboard={() => navigate(EMPLOYER_DASHBOARD_PATH)}
            onOpenSubmissionsExplorer={() => navigate(EMPLOYER_SUBMISSIONS_PATH)}
          />
        ) : resolvedPath === EMPLOYER_SUBMISSIONS_PATH ? (
          <EmployerSubmissionsExplorer
            user={session.user}
            onSignOut={handleSignOut}
            onBackToDashboard={() => navigate(EMPLOYER_DASHBOARD_PATH)}
            onOpenCreateAssignment={() => navigate(EMPLOYER_CREATE_ASSIGNMENT_PATH)}
            initialAssignmentId={assignmentIdFromSearch}
          />
        ) : (
          <EmployerDashboard
            user={session.user}
            onSignOut={handleSignOut}
            onOpenCreateAssignment={() => navigate(EMPLOYER_CREATE_ASSIGNMENT_PATH)}
            onOpenSubmissionsExplorer={(assignmentId) => {
              if (!assignmentId) {
                navigate(EMPLOYER_SUBMISSIONS_PATH)
                return
              }

              const query = new URLSearchParams({
                assignmentId
              })

              navigate(`${EMPLOYER_SUBMISSIONS_PATH}?${query.toString()}`)
            }}
          />
        )
      ) : resolvedPath === CANDIDATE_SUBMIT_REPOSITORY_PATH ? (
        <CandidateSubmitRepository
          user={session.user}
          onSignOut={handleSignOut}
          onBackToDashboard={() => navigate(CANDIDATE_DASHBOARD_PATH)}
        />
      ) : (
        <CandidatePending
          user={session.user}
          onSignOut={handleSignOut}
          onOpenSubmitRepository={() => navigate(CANDIDATE_SUBMIT_REPOSITORY_PATH)}
        />
      )}
    </div>
  )
}

export default App
