import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"

import { CandidateSubmitRepository } from "@/components/dashboard/candidate-submit-repository"
import { useSignOut } from "@/hooks/use-sign-out"

export const Route = createFileRoute("/_authed/candidate/submissions/new")({
  beforeLoad: ({ context }) => {
    if (context.session.user.role !== "candidate") {
      throw redirect({ to: "/employer/dashboard" })
    }
  },
  component: CandidateSubmitRepositoryPage,
})

function CandidateSubmitRepositoryPage() {
  const { session } = Route.useRouteContext()
  const navigate = useNavigate()
  const signOut = useSignOut()

  return (
    <CandidateSubmitRepository
      user={session.user}
      onSignOut={signOut}
      onBackToDashboard={() =>
        void navigate({ to: "/candidate/dashboard" })
      }
    />
  )
}
