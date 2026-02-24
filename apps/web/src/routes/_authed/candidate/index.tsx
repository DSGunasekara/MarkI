import { CandidatePending } from "@/components/dashboard/candidate-pending"
import { DashboardSkeleton } from "@/components/shared/page-skeletons"
import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_authed/candidate/")({
  beforeLoad: ({ context }) => {
    if (context.session.user.role !== "candidate") {
      throw redirect({ to: "/employer" })
    }
  },
  pendingComponent: () => <DashboardSkeleton metricCount={5} />,
  component: CandidateLayout,
})

function CandidateLayout() {

  return (
    <CandidatePending />
  )
}
