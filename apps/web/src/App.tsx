import { useCallback, useEffect, useState } from "react"

import { AuthPanel } from "@/components/auth/auth-panel"
import { CandidatePending } from "@/components/dashboard/candidate-pending"
import { EmployerDashboard } from "@/components/dashboard/employer-dashboard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { authApi, isUnauthorizedError, toErrorMessage, type SessionState } from "@/lib/api"

type BootstrapStatus = "loading" | "ready" | "error"

function App() {
  const [status, setStatus] = useState<BootstrapStatus>("loading")
  const [session, setSession] = useState<SessionState | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.classList.add("dark")
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
    await refreshSession()
  }, [refreshSession])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void refreshSession()
    }, 0)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [refreshSession])

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
    return (
      <div className="app-shell dark">
        <AuthPanel onAuthenticated={refreshSession} />
      </div>
    )
  }

  return (
    <div className="app-shell dark">
      {session.user.role === "employer" ? (
        <EmployerDashboard user={session.user} onSignOut={handleSignOut} />
      ) : (
        <CandidatePending user={session.user} onSignOut={handleSignOut} />
      )}
    </div>
  )
}

export default App
