import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { sessionQueryOptions } from "@/lib/auth"
import type { SessionState } from "@/lib/api"
import { WorkspaceShell } from "@/components/shared/workspace-shell"
import type { WorkspaceNavItem } from '@/components/shared/workspace-shell'

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
      console.log({session})
  
      const navItems: WorkspaceNavItem[] = session?.user.role === "candidate" ? [
          { key: "dashboard", label: "Dashboard", href: "/candidate" },
          { key: "submit-repository", label: "Submit Repository", href: "/candidate/submissions/new" },
      ] : session?.user.role === "employer" ? [
          { key: "dashboard", label: "Dashboard", href: "/employer" },
          { key: "submit-repository", label: "Submit Repository", href: "/employer/assignments/new" },
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
      <Card className="app-panel w-full max-w-md">
        <CardHeader>
          <CardTitle>Loading workspace...</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Checking your current session.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
