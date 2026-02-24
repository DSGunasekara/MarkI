import type { ReactNode } from "react"
import { Outlet, useLocation } from "@tanstack/react-router"

import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useSignOut } from "@/hooks/use-sign-out"
import type { SessionState } from "@/lib/api"

export type WorkspaceNavItem = {
  key: string
  label: string
  href: string
}

type WorkspaceShellProps = {
  workspaceLabel: string
  session: SessionState
  navItems: WorkspaceNavItem[]
  headerSlot?: ReactNode
  children: ReactNode
}

export function WorkspaceShell({
  workspaceLabel,
  session,
  navItems,
  headerSlot,
  children,
}: WorkspaceShellProps) {
  const location = useLocation()
  const signOut = useSignOut()

  const resolvedNavItems = navItems.map((item) => ({
    key: item.key,
    label: item.label,
    href: item.href,
    isActive: location.pathname === item.href,
  }))

  return (
    <SidebarProvider>
      <AppSidebar
        workspaceLabel={workspaceLabel}
        navItems={resolvedNavItems}
        user={{ name: session.user.name, email: session.user.email, avatar: "" }}
        onSignOut={signOut}
      />

      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
        </header>

        {headerSlot}
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
