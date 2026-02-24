import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"

import { EmployerSubmissionsExplorer } from "@/components/dashboard/employer-submissions-explorer"
import { useSignOut } from "@/hooks/use-sign-out"

type SubmissionsSearch = {
  assignmentId?: string
}

export const Route = createFileRoute("/_authed/employer/submissions")({
  validateSearch: (search: Record<string, unknown>): SubmissionsSearch => ({
    assignmentId:
      typeof search.assignmentId === "string"
        ? search.assignmentId
        : undefined,
  }),
  beforeLoad: ({ context }) => {
    if (context.session.user.role !== "employer") {
      throw redirect({ to: "/candidate/dashboard" })
    }
  },
  component: EmployerSubmissionsPage,
})

function EmployerSubmissionsPage() {
  const { session } = Route.useRouteContext()
  const { assignmentId } = Route.useSearch()
  const navigate = useNavigate()
  const signOut = useSignOut()

  return (
    <EmployerSubmissionsExplorer
      user={session.user}
      onSignOut={signOut}
      onBackToDashboard={() =>
        void navigate({ to: "/employer/dashboard" })
      }
      onOpenCreateAssignment={() =>
        void navigate({ to: "/employer/assignments/new" })
      }
      initialAssignmentId={assignmentId ?? null}
    />
  )
}
