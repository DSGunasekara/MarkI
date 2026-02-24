import { createFileRoute } from "@tanstack/react-router"

import { EmployerAssignmentsList } from "@/components/dashboard/employer-assignments-list"

export const Route = createFileRoute("/_authed/employer/assignments/")(
  {
    component: EmployerAssignmentsPage,
  }
)

function EmployerAssignmentsPage() {
  return <EmployerAssignmentsList />
}
