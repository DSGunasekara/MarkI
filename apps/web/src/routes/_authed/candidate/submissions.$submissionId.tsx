import { createFileRoute } from "@tanstack/react-router"
import { CandidateSubmissionLogs } from "@/components/dashboard/candidate-submission-logs"
import { DashboardSkeleton } from "@/components/shared/page-skeletons"

export const Route = createFileRoute("/_authed/candidate/submissions/$submissionId")({
  pendingComponent: () => <DashboardSkeleton metricCount={0} />,
  component: CandidateSubmissionLogsPage,
})

function CandidateSubmissionLogsPage() {
  const { submissionId } = Route.useParams()
  return <CandidateSubmissionLogs submissionId={submissionId} />
}
