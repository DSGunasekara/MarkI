import { createFileRoute } from "@tanstack/react-router"

import { CandidateSubmitRepository } from "@/components/dashboard/candidate-submit-repository"

export const Route = createFileRoute("/_authed/candidate/submissions/new")({
  component: CandidateSubmitRepositoryPage,
})

function CandidateSubmitRepositoryPage() {
  return <CandidateSubmitRepository />
}
