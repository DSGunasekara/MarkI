import { CandidatePending } from "@/components/dashboard/candidate-pending"
import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_authed/candidate/")({
  beforeLoad: ({ context }) => {
    if (context.session.user.role !== "candidate") {
      throw redirect({ to: "/employer" })
    }
  },
  component: CandidateLayout,
})

function CandidateLayout() {

  return (
    <CandidatePending />
  )
}
