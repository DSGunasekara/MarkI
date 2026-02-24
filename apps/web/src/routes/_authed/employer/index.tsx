import { createFileRoute } from "@tanstack/react-router"
import { EmployerDashboard } from "@/components/dashboard/employer-dashboard"
import { DashboardSkeleton } from "@/components/shared/page-skeletons"

export const Route = createFileRoute("/_authed/employer/")({
  pendingComponent: () => <DashboardSkeleton metricCount={6} />,
  component: EmployerDashboardPage,
})

function EmployerDashboardPage() {

  return  <EmployerDashboard /> 
}
