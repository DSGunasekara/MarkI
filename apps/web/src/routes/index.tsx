import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"

import { PlatformLanding } from "@/components/marketing/platform-landing"
import { sessionQueryOptions, getDefaultPathForRole } from "@/lib/auth"

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions,
    )
    if (session) {
      throw redirect({ to: getDefaultPathForRole(session.user.role) })
    }
  },
  component: LandingPage,
})

function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="app-shell dark">
      <PlatformLanding
        onOpenAuth={() => void navigate({ to: "/auth/login" })}
        onNavigateHome={() => void navigate({ to: "/" })}
      />
    </div>
  )
}
