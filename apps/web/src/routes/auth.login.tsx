import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"

import { AuthPanel } from "@/components/auth/auth-panel"
import { sessionQueryOptions, getDefaultPathForRole } from "@/lib/auth"

type AuthLoginSearch = {
  next?: string
}

export const Route = createFileRoute("/auth/login")({
  validateSearch: (search: Record<string, unknown>): AuthLoginSearch => ({
    next: typeof search.next === "string" ? search.next : undefined,
  }),
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions,
    )
    if (session) {
      throw redirect({ to: getDefaultPathForRole(session.user.role) })
    }
  },
  component: AuthLoginPage,
})

function AuthLoginPage() {
  const navigate = useNavigate()
  const { next: redirectTo } = Route.useSearch()
  const { queryClient } = Route.useRouteContext()

  const handleAuthenticated = async () => {
    await queryClient.invalidateQueries({ queryKey: ["session"] })
    const session = await queryClient.fetchQuery(sessionQueryOptions)
    if (redirectTo) {
      void navigate({ to: redirectTo })
      return
    }

    if (session) {
      void navigate({ to: getDefaultPathForRole(session.user.role) })
    }
  }

  return (
    <div className="app-shell dark">
      <AuthPanel
        onAuthenticated={handleAuthenticated}
        onNavigateHome={() => void navigate({ to: "/" })}
      />
    </div>
  )
}
