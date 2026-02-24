import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"

import { CandidatePending } from "@/components/dashboard/candidate-pending"
import { useSignOut } from "@/hooks/use-sign-out"

export const Route = createFileRoute("/_authed/candidate/dashboard")({
  beforeLoad: ({ context }) => {
    if (context.session.user.role !== "candidate") {
      throw redirect({ to: "/employer/dashboard" })
    }
  },
  component: CandidateDashboardPage,
})

function CandidateDashboardPage() {
  const { session } = Route.useRouteContext()
  const navigate = useNavigate()
  const signOut = useSignOut()

  return (
    <CandidatePending
      user={session.user}
      onSignOut={signOut}
      onOpenSubmitRepository={() =>
        void navigate({ to: "/candidate/submissions/new" })
      }
    />
  )
}
