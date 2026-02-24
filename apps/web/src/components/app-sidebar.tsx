import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

type NavItem = {
  key: string
  label: string
  icon?: React.ReactNode
  isActive: boolean
  onClick: () => void
}

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  workspaceLabel: string
  navItems: NavItem[]
  user: {
    name: string
    email: string
    avatar: string
  }
  onSignOut: () => Promise<void>
}

export function AppSidebar({
  workspaceLabel,
  navItems,
  user,
  onSignOut,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg text-xs font-bold">
                C
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Codr AI</span>
                <span className="truncate text-xs">{workspaceLabel}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((navItem) => (
                <SidebarMenuItem key={navItem.key}>
                  <SidebarMenuButton
                    isActive={navItem.isActive}
                    onClick={navItem.onClick}
                    tooltip={navItem.label}
                  >
                    {navItem.icon}
                    <span>{navItem.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} onSignOut={() => void onSignOut()} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

