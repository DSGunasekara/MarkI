import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { sessionQueryOptions } from "@/lib/auth"
import type { SessionState } from "@/lib/api"
import { WorkspaceShell } from "@/components/shared/workspace-shell"
import { UserIcon, UploadIcon, DockIcon } from "lucide-react"
import type { WorkspaceNavItem } from "@/components/shared/workspace-shell"

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions,
    )

    if (!session) {
      throw redirect({
        to: "/auth/login",
        search: { next: location.href },
      })
    }

    return { session: session as SessionState }
  },
  pendingComponent: LoadingWorkspace,
  component: AuthedLayout,
})

function AuthedLayout() {
  const { session } = Route.useRouteContext()
      const navItems: WorkspaceNavItem[] = session?.user.role === "candidate" ? [
          { key: "dashboard", label: "Dashboard", href: "/candidate", icon: <UserIcon /> },
          { key: "submit-repository", label: "Submit Repository", href: "/candidate/submissions/new", icon: <UploadIcon /> },
      ] : session?.user.role === "employer" ? [
          { key: "dashboard", label: "Dashboard", href: "/employer", icon: <UserIcon /> },
          { key: "assignments", label: "Assignments", href: "/employer/assignments", icon: <DockIcon /> },
          { key: "submissions", label: "Submissions", href: "/employer/submissions", icon: <UploadIcon /> },
      ] : []
  
      return <WorkspaceShell
          workspaceLabel={session?.user.role === "candidate" ? "Candidate Workspace" : "Employer Workspace"}
          session={session}
          navItems={navItems}
      >
          <Outlet />
      </WorkspaceShell>
}

function LoadingWorkspace() {
  return (
    <main className="app-shell dark flex items-center justify-center px-4 py-16">
      <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
        <div className="relative flex h-12 w-12 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-muted" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium text-foreground">Loading workspace</p>
          <p className="text-xs text-muted-foreground">Checking your current session…</p>
        </div>
      </div>
    </main>
  )
}
