import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"

import { EmployerCreateAssignment } from "@/components/dashboard/employer-create-assignment"
import { useSignOut } from "@/hooks/use-sign-out"

export const Route = createFileRoute("/_authed/employer/assignments/new")({
  beforeLoad: ({ context }) => {
    if (context.session.user.role !== "employer") {
      throw redirect({ to: "/candidate/dashboard" })
    }
  },
  component: EmployerCreateAssignmentPage,
})

function EmployerCreateAssignmentPage() {
  const { session } = Route.useRouteContext()
  const navigate = useNavigate()
  const signOut = useSignOut()

  return (
    <EmployerCreateAssignment
      user={session.user}
      onSignOut={signOut}
      onBackToDashboard={() =>
        void navigate({ to: "/employer/dashboard" })
      }
      onOpenSubmissionsExplorer={() =>
        void navigate({ to: "/employer/submissions" })
      }
    />
  )
}
