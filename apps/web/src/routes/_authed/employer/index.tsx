import { createFileRoute } from "@tanstack/react-router"

import { WorkspaceShell } from "@/components/shared/workspace-shell"
import type { WorkspaceNavItem } from "@/components/shared/workspace-shell"
import { EmployerDashboard } from "@/components/dashboard/employer-dashboard"

const employerNavItems: WorkspaceNavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/employer/dashboard" },
  { key: "assignments", label: "Assignments", href: "/employer/assignments" },
]

export const Route = createFileRoute("/_authed/employer/")({
  component: EmployerDashboardPage,
})

function EmployerDashboardPage() {
  const { session } = Route.useRouteContext()

  return  <EmployerDashboard /> 
}
