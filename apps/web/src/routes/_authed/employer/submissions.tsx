import { createFileRoute } from "@tanstack/react-router"

import { EmployerSubmissionsExplorer } from "@/components/dashboard/employer-submissions-explorer"
import { SubmissionsExplorerSkeleton } from "@/components/shared/page-skeletons"

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
  pendingComponent: SubmissionsExplorerSkeleton,
  component: EmployerSubmissionsPage,
})

function EmployerSubmissionsPage() {
  const { assignmentId } = Route.useSearch()

  return <EmployerSubmissionsExplorer initialAssignmentId={assignmentId ?? null} />
}
