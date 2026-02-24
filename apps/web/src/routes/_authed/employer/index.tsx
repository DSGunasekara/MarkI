import { createFileRoute } from "@tanstack/react-router"
import { EmployerDashboard } from "@/components/dashboard/employer-dashboard"

export const Route = createFileRoute("/_authed/employer/")({
  component: EmployerDashboardPage,
})

function EmployerDashboardPage() {

  return  <EmployerDashboard /> 
}
