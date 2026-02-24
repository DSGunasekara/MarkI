import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"

import { EmployerDashboard } from "@/components/dashboard/employer-dashboard"
import { useSignOut } from "@/hooks/use-sign-out"

export const Route = createFileRoute("/_authed/employer/dashboard")({
  beforeLoad: ({ context }) => {
    if (context.session.user.role !== "employer") {
      throw redirect({ to: "/candidate/dashboard" })
    }
  },
  component: EmployerDashboardPage,
})

function EmployerDashboardPage() {
  const { session } = Route.useRouteContext()
  const navigate = useNavigate()
  const signOut = useSignOut()

  return (
    <EmployerDashboard
      user={session.user}
      onSignOut={signOut}
      onOpenCreateAssignment={() =>
        void navigate({ to: "/employer/assignments/new" })
      }
      onOpenSubmissionsExplorer={(assignmentId) => {
        void navigate({
          to: "/employer/submissions",
          search: assignmentId ? { assignmentId } : {},
        })
      }}
    />
  )
}
