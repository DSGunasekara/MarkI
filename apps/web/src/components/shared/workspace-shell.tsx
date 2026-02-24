import type { ReactNode } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type WorkspaceNavItem = {
  key: string
  label: string
  isActive: boolean
  onClick: () => void
}

type WorkspaceShellProps = {
  workspaceLabel: string
  title: string
  description: string
  user: {
    name: string
    email: string
    avatar: string
  }
  navItems: WorkspaceNavItem[]
  onSignOut: () => Promise<void>
  children: ReactNode
  headerActions?: ReactNode
  maxWidthClassName?: string
}

export function WorkspaceShell({
  workspaceLabel,
  title,
  description,
  user,
  navItems,
  onSignOut,
  children,
  headerActions,
  maxWidthClassName = "max-w-7xl"
}: WorkspaceShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar
        workspaceLabel={workspaceLabel}
        navItems={navItems}
        user={user}
        onSignOut={onSignOut}
      />

      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
        </header>

        <div className={cn("mx-auto w-full space-y-4 px-4 py-4 md:px-6 lg:px-8", maxWidthClassName)}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            {headerActions ? <div className="flex items-center gap-2">{headerActions}</div> : null}
          </div>

          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

