import { Link, useLocation } from "react-router"

import { BrandMark } from "@/components/common/BrandMark"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

import { ADMIN_NAV_GROUPS, isNavItemActive } from "./navigation"

/** Admin sidebar: QNU brand on top, grouped links, collapses to icons (Ctrl/Cmd + B). */
export function AppSidebar() {
  const location = useLocation()
  const { state, isMobile, setOpenMobile } = useSidebar()
  const collapsed = state === "collapsed" && !isMobile
  // On phones the sidebar is a drawer: close it after choosing a page
  const closeOnNavigate = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="NamBeDe — Trường Đại học Quy Nhơn"
              className="gap-0 hover:bg-transparent active:bg-transparent"
              render={<Link to="/dashboard" aria-label="Về bảng điều khiển" onClick={closeOnNavigate} />}
            >
              <BrandMark collapsed={collapsed} size={32} />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-1">
        {ADMIN_NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isNavItemActive(location.pathname, item.to)
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={item.label}
                        className={cn(
                          "relative",
                          // Accent bar on the left of the current page, hidden when collapsed
                          active &&
                            "before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary group-data-[collapsible=icon]:before:hidden"
                        )}
                        render={<Link to={item.to} onClick={closeOnNavigate} />}
                      >
                        <item.icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
