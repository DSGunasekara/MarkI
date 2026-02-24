import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  userEmail: string
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
  userEmail,
  navItems,
  onSignOut,
  children,
  headerActions,
  maxWidthClassName = "max-w-7xl"
}: WorkspaceShellProps) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <aside className="border-b border-border bg-card/60 md:border-r md:border-b-0">
        <div className="flex h-full flex-col gap-4 p-4 md:sticky md:top-0 md:h-screen">
          <div>
            <p className="app-overline">Codr AI</p>
            <p className="text-sm font-medium">{workspaceLabel}</p>
          </div>

          <nav className="flex flex-wrap gap-2 md:flex-col">
            {navItems.map((navItem) => (
              <Button
                key={navItem.key}
                type="button"
                size="sm"
                variant={navItem.isActive ? "secondary" : "ghost"}
                className={cn("justify-start", navItem.isActive ? "font-medium" : "")}
                onClick={navItem.onClick}
              >
                {navItem.label}
              </Button>
            ))}
          </nav>

          <div className="mt-auto flex flex-wrap items-center gap-2 md:flex-col md:items-stretch">
            <Badge variant="outline" className="justify-center md:justify-start">
              {userEmail}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => void onSignOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      <main className="min-w-0">
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
      </main>
    </div>
  )
}
