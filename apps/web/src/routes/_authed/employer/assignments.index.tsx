import { createFileRoute } from "@tanstack/react-router"

import { EmployerAssignmentsList } from "@/components/dashboard/employer-assignments-list"
import { AssignmentsListSkeleton } from "@/components/shared/page-skeletons"

export const Route = createFileRoute("/_authed/employer/assignments/")(
  {
    pendingComponent: AssignmentsListSkeleton,
    component: EmployerAssignmentsPage,
  }
)

function EmployerAssignmentsPage() {
  return <EmployerAssignmentsList />
}
