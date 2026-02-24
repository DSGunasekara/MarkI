import { createFileRoute } from "@tanstack/react-router"

import { CandidateSubmitRepository } from "@/components/dashboard/candidate-submit-repository"
import { SubmitRepositorySkeleton } from "@/components/shared/page-skeletons"

export const Route = createFileRoute("/_authed/candidate/submissions/new")({
  pendingComponent: SubmitRepositorySkeleton,
  component: CandidateSubmitRepositoryPage,
})

function CandidateSubmitRepositoryPage() {
  return <CandidateSubmitRepository />
}
